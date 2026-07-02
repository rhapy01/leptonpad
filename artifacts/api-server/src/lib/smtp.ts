import net from "node:net";
import tls from "node:tls";
import { randomBytes } from "node:crypto";

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}

export interface SmtpMessage {
  from: string;
  to: string;
  /** Display name for the recipient — improves deliverability vs bare addresses */
  toName?: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  /** Required for bulk/newsletter mail — improves deliverability and compliance */
  listUnsubscribe?: string;
}

/** RFC 5322 mailbox: "Isaac Akintoye" <user@example.com> */
export function formatMailbox(name: string | undefined, email: string): string {
  const addr = email.trim();
  const display = name?.trim();
  if (!display) return addr;
  const escaped = display.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}" <${addr}>`;
}

function encodeBase64(value: string): string {
  return Buffer.from(value, "utf8").toString("base64");
}

function extractAddress(value: string): string {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] ?? value).trim();
}

function messageId(from: string): string {
  const domain = extractAddress(from).split("@")[1] ?? "leptonpad.local";
  return `<${Date.now()}.${randomBytes(8).toString("hex")}@${domain}>`;
}

function buildMime(message: SmtpMessage): string {
  const boundary = `lp-${Date.now().toString(36)}`;
  const subject = message.subject.replace(/\r?\n/g, " ");
  const headers = [
    `From: ${message.from}`,
    `To: ${formatMailbox(message.toName, message.to)}`,
    `Subject: ${subject}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${messageId(message.from)}`,
    "MIME-Version: 1.0",
  ];

  if (message.replyTo) {
    headers.push(`Reply-To: ${message.replyTo}`);
  }
  if (message.listUnsubscribe) {
    headers.push(`List-Unsubscribe: <${message.listUnsubscribe}>`);
    headers.push("List-Unsubscribe-Post: List-Unsubscribe=One-Click");
  }

  headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);

  const body = [
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    message.text,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    message.html,
    "",
    `--${boundary}--`,
    "",
  ];

  return `${headers.join("\r\n")}\r\n${body.join("\r\n")}`;
}

class SmtpSession {
  private buffer = "";

  constructor(
    private socket: net.Socket | tls.TLSSocket,
    private config: SmtpConfig,
    private useStartTls: boolean,
  ) {}

  private onData(handler: (chunk: Buffer) => void): void {
    this.socket.on("data", handler);
  }

  private offData(handler: (chunk: Buffer) => void): void {
    this.socket.off("data", handler);
  }

  private write(line: string): void {
    this.socket.write(`${line}\r\n`);
  }

  private waitForResponse(timeoutMs = 30_000): Promise<string> {
    return new Promise((resolve, reject) => {
      const tryComplete = () => {
        const lines = this.buffer.split(/\r?\n/).filter(Boolean);
        const last = lines.at(-1) ?? "";
        if (!/^\d{3} /.test(last)) return false;

        const response = this.buffer.trim();
        this.buffer = "";
        const code = Number(last.slice(0, 3));
        if (code >= 400) {
          reject(new Error(response));
        } else {
          resolve(response);
        }
        return true;
      };

      const timer = setTimeout(() => {
        this.offData(onData);
        reject(new Error("SMTP response timeout"));
      }, timeoutMs);

      const onData = (chunk: Buffer) => {
        this.buffer += chunk.toString("utf8");
        if (tryComplete()) {
          clearTimeout(timer);
          this.offData(onData);
        }
      };

      this.onData(onData);
      if (tryComplete()) {
        clearTimeout(timer);
        this.offData(onData);
      }
    });
  }

  private async command(line: string): Promise<string> {
    this.write(line);
    return this.waitForResponse();
  }

  private async startTls(): Promise<void> {
    await this.command("STARTTLS");
    const plain = this.socket as net.Socket;
    const secure = await new Promise<tls.TLSSocket>((resolve, reject) => {
      const upgraded = tls.connect(
        { socket: plain, servername: this.config.host },
        () => resolve(upgraded),
      );
      upgraded.once("error", reject);
    });
    this.socket = secure;
  }

  private async auth(): Promise<void> {
    await this.command("AUTH LOGIN");
    await this.command(encodeBase64(this.config.user));
    await this.command(encodeBase64(this.config.pass));
  }

  async send(message: SmtpMessage): Promise<string> {
    await this.waitForResponse();
    await this.command("EHLO leptonpad");

    if (this.useStartTls) {
      await this.startTls();
      await this.command("EHLO leptonpad");
    }

    await this.auth();

    const toAddr = extractAddress(message.to);
    // Envelope sender must match the authenticated SMTP account (Gmail requirement).
    const envelopeFrom = this.config.user;

    await this.command(`MAIL FROM:<${envelopeFrom}>`);
    await this.command(`RCPT TO:<${toAddr}>`);
    await this.command("DATA");

    const mime = buildMime(message);
    this.socket.write(`${mime}\r\n.\r\n`);
    const response = await this.waitForResponse();
    await this.command("QUIT");
    this.socket.end();
    return response;
  }
}

function connectSocket(host: string, port: number): Promise<net.Socket | tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    if (port === 465) {
      const socket = tls.connect({ host, port, servername: host }, () => resolve(socket));
      socket.once("error", reject);
      return;
    }

    const socket = net.connect({ host, port }, () => resolve(socket));
    socket.once("error", reject);
  });
}

export async function sendSmtpMail(config: SmtpConfig, message: SmtpMessage): Promise<string> {
  const socket = await connectSocket(config.host, config.port);
  const session = new SmtpSession(socket, config, config.port !== 465);

  try {
    return await session.send(message);
  } catch (err) {
    socket.destroy();
    throw err;
  }
}
