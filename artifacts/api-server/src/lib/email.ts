import { logger } from "./logger";
import { sendSmtpMail } from "./smtp";

function smtpUser(): string | null {
  return process.env.SMTP_USER?.trim() || null;
}

function smtpPass(): string | null {
  return process.env.SMTP_PASS?.trim() || null;
}

function smtpHost(): string {
  return process.env.SMTP_HOST?.trim() || "smtp.gmail.com";
}

function smtpPort(): number {
  const port = Number(process.env.SMTP_PORT ?? "587");
  return Number.isFinite(port) && port > 0 ? port : 587;
}

function fromAddress(): string {
  const user = smtpUser();
  if (!user) return "LeptonPad";

  const configured = process.env.SMTP_FROM?.trim();
  if (configured) {
    const configuredEmail = configured.match(/<([^>]+)>/)?.[1] ?? configured;
    if (configuredEmail.toLowerCase() === user.toLowerCase()) return configured;
    logger.warn(
      { configured: configuredEmail, smtpUser: user },
      "SMTP_FROM address must match SMTP_USER — using LeptonPad <SMTP_USER>",
    );
  }
  return `LeptonPad <${user}>`;
}

function replyToAddress(): string | undefined {
  return process.env.SMTP_REPLY_TO?.trim() || smtpUser() || undefined;
}

export interface SendEmailInput {
  to: string;
  /** Full recipient name — used in the To header and greeting for deliverability */
  recipientName?: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey?: string;
  listUnsubscribe?: string;
}

function greetingName(name: string): string {
  return name.trim() || "there";
}

/** Plain-text fallback for HTML email bodies (e.g. TipTap output). */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function isEmailConfigured(): boolean {
  return Boolean(smtpUser() && smtpPass());
}

export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const user = smtpUser();
  const pass = smtpPass();
  if (!user || !pass) {
    logger.warn("SMTP email skipped: set SMTP_USER and SMTP_PASS in .env");
    return false;
  }

  try {
    const response = await sendSmtpMail(
      { host: smtpHost(), port: smtpPort(), user, pass },
      {
        from: fromAddress(),
        to: input.to,
        toName: input.recipientName,
        subject: input.subject,
        html: input.html,
        text: input.text,
        replyTo: replyToAddress(),
        listUnsubscribe: input.listUnsubscribe,
      },
    );

    logger.info({ to: input.to, subject: input.subject, response }, "SMTP email sent");
    return true;
  } catch (err) {
    logger.error({ err, to: input.to, subject: input.subject }, "SMTP email failed");
    return false;
  }
}

/** Fire-and-forget — never blocks the request path */
export function sendEmailAsync(input: SendEmailInput): void {
  void sendEmail(input);
}

const brand = {
  paper: "#FAFAF9",
  card: "#FFFFFF",
  ink: "#1C1917",
  muted: "#78716C",
  border: "rgba(28,25,23,0.12)",
  rule: "#1C1917",
  highlight: "#F5F0E8",
};

function appUrl(): string {
  return process.env.APP_URL ?? process.env.PUBLIC_URL ?? "https://lepton-pad.vercel.app";
}

function sans(size: number, extra = ""): string {
  return `font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:${size}px;${extra}`;
}

function editorialBlock(label: string, heading: string, body: string, link?: { href: string; text: string }): string {
  const linkHtml = link
    ? `<p style="margin:14px 0 0;${sans(14, "font-weight:600")}"><a href="${link.href}" style="color:${brand.ink};text-decoration:none">${link.text} →</a></p>`
    : "";
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:28px 0 0">
    <tr><td style="padding-top:20px;border-top:1px solid ${brand.border}">
      <p style="margin:0 0 8px;${sans(11, `letter-spacing:0.14em;text-transform:uppercase;color:${brand.muted}`)}">${label}</p>
      <p style="margin:0 0 10px;font-size:20px;font-weight:700;line-height:1.35;color:${brand.ink}">${heading}</p>
      <p style="margin:0;${sans(15, `line-height:1.75;color:${brand.muted}`)}">${body}</p>
      ${linkHtml}
    </td></tr>
  </table>`;
}

function pullQuote(text: string): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0">
    <tr><td style="padding:18px 20px;border-left:3px solid ${brand.ink};background:${brand.highlight}">
      <p style="margin:0;font-size:17px;line-height:1.55;color:${brand.ink};font-style:italic">${text}</p>
    </td></tr>
  </table>`;
}

function layout(title: string, body: string): string {
  const site = appUrl();
  const siteLabel = site.replace(/^https?:\/\//, "");
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:${brand.paper};font-family:Georgia,'Times New Roman',serif;color:${brand.ink}">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${brand.paper};padding:40px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:${brand.card};border:1px solid ${brand.border}">
        <tr><td style="padding:28px 36px 20px;border-bottom:2px solid ${brand.rule}">
          <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:${brand.muted}">LeptonPad</p>
          <p style="margin:6px 0 0;font-size:11px;letter-spacing:0.08em;color:${brand.muted}">Read · Publish · Get paid per piece</p>
        </td></tr>
        <tr><td style="padding:32px 36px">
          <h1 style="margin:0 0 24px;font-size:28px;font-weight:700;line-height:1.25;color:${brand.ink}">${title}</h1>
          ${body}
        </td></tr>
        <tr><td style="padding:20px 36px 28px;border-top:1px solid ${brand.border}">
          <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;line-height:1.6;color:${brand.muted}">
            LeptonPad · <a href="${site}" style="color:${brand.muted}">${siteLabel}</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function buildWelcomeEmail(to: string, name: string): SendEmailInput {
  const who = greetingName(name);
  const base = appUrl();

  const text = [
    `Hi ${who},`,
    "",
    "Welcome to LeptonPad — glad to have you. Your account is ready.",
    "",
    "LeptonPad is pay-per-piece publishing for articles, audio, and video. Subscriptions bundle; we sell the single piece. Readers unlock only what they choose. Creators keep 95% of every sale — paid in USDC on Arc, settled in under half a second.",
    "",
    "IF YOU'RE HERE TO READ",
    "Browse the feed, open any piece, read the free preview, then unlock it with your in-app wallet (USDC on Arc — no MetaMask required). Unlocked work stays in your Collection forever. You never pay twice for the same piece.",
    `${base}/feed`,
    "",
    "IF YOU'RE HERE TO PUBLISH",
    "Upload an article, audio file, or video, set a price, and publish. When someone unlocks it, payment splits on-chain: 95% to you, 5% for infrastructure. Verified creators keep 100%.",
    `${base}/create`,
    "",
    "Your LeptonPad wallet is provisioned when you sign in. Fund it from Wallet, optionally pick feed categories, and you're in.",
    "",
    `— LeptonPad · ${base}`,
  ].join("\n");

  const html = layout(
    `Welcome to LeptonPad, ${who}.`,
    `<p style="margin:0 0 20px;${sans(16, `line-height:1.75;color:${brand.ink}`)}">
         Glad to have you. Your account is ready — read, publish, or both.
       </p>
       <p style="margin:0;${sans(15, `line-height:1.75;color:${brand.muted}`)}">
         Most platforms force subscriptions and bundles. You pay monthly for an entire catalogue when you wanted <em>one</em> essay, <em>one</em> song, or <em>one</em> film. LeptonPad works differently.
       </p>
       ${pullQuote("Subscriptions bundle. LeptonPad sells the single piece.")}
       <p style="margin:0;${sans(15, `line-height:1.75;color:${brand.muted}`)}">
         Every article, recording, and film is priced individually. Readers unlock only what they want. Creators set the price and keep <strong style="color:${brand.ink}">95%</strong> of every sale — settled in USDC on Arc, usually in under 500 milliseconds. No payout cycles. No algorithm deciding what you see.
       </p>
       ${editorialBlock(
         "For readers",
         "Pay only for what you actually unlock.",
         "Browse the feed, read the preview, then unlock a piece with your in-app wallet — USDC on Arc, no browser extension. Unlocked work lives in your <strong>Collection</strong> permanently. You never pay twice for the same article, recording, or film.",
         { href: `${base}/feed`, text: "Open the feed" },
       )}
       ${editorialBlock(
         "For creators",
         "Keep 95%. Get paid in seconds.",
         "Publish an essay, audio piece, or video and set your price. When a reader unlocks it, payment splits on-chain — 95% to your wallet, 5% for infrastructure. Verified creators keep 100%. Your earnings dashboard links straight to the Arc transaction.",
         { href: `${base}/create`, text: "Publish your first piece" },
       )}
       <p style="margin:28px 0 0;padding-top:20px;border-top:1px solid ${brand.border};${sans(14, `line-height:1.7;color:${brand.muted}`)}">
         Your LeptonPad wallet is ready when you sign in. Fund it from <a href="${base}/wallet" style="color:${brand.ink}">Wallet</a>, optionally <a href="${base}/onboarding" style="color:${brand.ink}">pick categories</a> for your feed, and you're in.
       </p>`,
  );

  return {
    to,
    recipientName: who,
    subject: "Welcome to LeptonPad",
    idempotencyKey: `welcome-${to}`,
    text,
    html,
  };
}

export function sendWelcomeEmail(to: string, name: string): void {
  sendEmailAsync(buildWelcomeEmail(to, name));
}

export function sendPurchaseReceiptEmail(input: {
  to: string;
  readerName: string;
  contentTitle: string;
  amountPaid: number;
  paymentId: number;
}): void {
  const amount = input.amountPaid.toFixed(6).replace(/\.?0+$/, "") || "0";
  const who = greetingName(input.readerName);
  sendEmailAsync({
    to: input.to,
    recipientName: who,
    subject: `Receipt: ${input.contentTitle}`,
    idempotencyKey: `receipt-${input.paymentId}`,
    text: `Hi ${who}, you unlocked "${input.contentTitle}" for $${amount} USDC on LeptonPad.`,
    html: layout(
      "Purchase receipt",
      `<p style="color:${brand.muted};line-height:1.6">Hi ${who}, thanks for your purchase.</p>
       <table style="width:100%;margin-top:16px;border-collapse:collapse">
         <tr><td style="padding:8px 0;color:${brand.muted}">Content</td><td style="padding:8px 0;text-align:right">${input.contentTitle}</td></tr>
         <tr><td style="padding:8px 0;color:${brand.muted}">Amount</td><td style="padding:8px 0;text-align:right;color:${brand.ink};font-weight:600">$${amount} USDC</td></tr>
         <tr><td style="padding:8px 0;color:${brand.muted}">Receipt #</td><td style="padding:8px 0;text-align:right">${input.paymentId}</td></tr>
       </table>`,
    ),
  });
}

export function sendCreatorSaleEmail(input: {
  to: string;
  creatorName: string;
  contentTitle: string;
  creatorReceives: number;
  verified?: boolean;
}): void {
  const amount = input.creatorReceives.toFixed(6).replace(/\.?0+$/, "") || "0";
  const shareLabel = input.verified ? "100% share (verified)" : "95% share";
  const who = greetingName(input.creatorName);
  sendEmailAsync({
    to: input.to,
    recipientName: who,
    subject: `You earned $${amount} USDC`,
    idempotencyKey: `sale-${input.contentTitle}-${input.creatorReceives}`,
    text: `Hi ${who}, someone unlocked "${input.contentTitle}". You received $${amount} USDC (${shareLabel}).`,
    html: layout(
      "New sale",
      `<p style="color:${brand.muted};line-height:1.6">Hi ${who}, a reader just unlocked your content.</p>
       <p style="font-size:28px;font-weight:700;color:${brand.ink};margin:16px 0">$${amount} USDC</p>
       <p style="color:${brand.muted}">${input.contentTitle}</p>
       <p style="color:${brand.muted};font-size:12px;margin-top:8px">${shareLabel}</p>`,
    ),
  });
}

export function sendOnboardingCompleteEmail(to: string, name: string): void {
  const who = greetingName(name);
  const base = appUrl();
  sendEmailAsync({
    to,
    recipientName: who,
    subject: "Your feed is ready",
    idempotencyKey: `onboarding-${to}`,
    text: `Hi ${who},\n\nYour LeptonPad feed is personalised. Browse: ${base}/feed\nPublish: ${base}/create\n\n— LeptonPad`,
    html: layout(
      "Your feed is ready",
      `<p style="margin:0 0 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.7;color:${brand.muted}">Hi ${who}, your interests are saved. Here’s what to do next.</p>
       <p style="margin-top:20px">
         <a href="${base}/feed" style="display:inline-block;background:${brand.ink};color:#FFFFFF;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:6px;margin-right:8px">Browse your feed</a>
         <a href="${base}/create" style="display:inline-block;border:1px solid ${brand.border};color:${brand.ink};text-decoration:none;font-weight:600;padding:11px 24px;border-radius:6px">Publish</a>
       </p>`,
    ),
  });
}

export function sendCreatorVerifiedEmail(to: string, name: string): void {
  const who = greetingName(name);
  sendEmailAsync({
    to,
    recipientName: who,
    subject: "Your LeptonPad creator account is verified",
    idempotencyKey: `verified-${to}`,
    text: `Hi ${who}, your creator account has been verified on LeptonPad. You now keep 100% of every sale and tip — no platform fee.`,
    html: layout(
      "Creator verified",
      `<p style="color:${brand.muted};line-height:1.6">Hi ${who}, your account now has <strong style="color:${brand.ink}">verified creator</strong> status.</p>
       <ul style="color:${brand.muted};line-height:1.8;padding-left:20px;margin:16px 0">
         <li>Readers see your verified badge on your profile and content</li>
         <li>You keep <strong style="color:${brand.ink}">100%</strong> of every sale and tip — no platform fee</li>
       </ul>`,
    ),
  });
}

export function sendNewsletterEmail(input: {
  to: string;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  batchId: string;
}): void {
  const who = greetingName(input.name);
  const base = appUrl();
  sendEmailAsync({
    to: input.to,
    recipientName: who,
    subject: input.subject,
    idempotencyKey: `newsletter-${input.batchId}-${input.to}`,
    listUnsubscribe: `${base}/settings`,
    text: `Hi ${who},\n\n${input.bodyText}\n\n— LeptonPad`,
    html: layout(
      input.subject,
      `<p style="color:${brand.muted};line-height:1.6">Hi ${who},</p>
       <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:${brand.ink};line-height:1.7">
         <style>
           .lp-newsletter h2 { font-size:1.25rem;font-weight:700;margin:1.25rem 0 0.5rem;color:${brand.ink}; }
           .lp-newsletter h3 { font-size:1.1rem;font-weight:600;margin:1rem 0 0.5rem;color:${brand.ink}; }
           .lp-newsletter p { margin:0 0 12px; }
           .lp-newsletter ul,.lp-newsletter ol { margin:0 0 12px;padding-left:1.5rem; }
           .lp-newsletter blockquote { margin:12px 0;padding-left:16px;border-left:3px solid ${brand.ink};color:${brand.muted}; }
           .lp-newsletter a { color:${brand.ink}; }
           .lp-newsletter img { max-width:100%;height:auto;border-radius:4px; }
         </style>
         <div class="lp-newsletter">${input.bodyHtml}</div>
       </div>`,
    ),
  });
}

export function sendCreatorNewWorkEmail(input: {
  to: string;
  readerName: string;
  creatorName: string;
  contentTitle: string;
  contentPreview: string | null;
  contentType: string;
  contentUrl: string;
  contentId: number;
}): void {
  const who = greetingName(input.readerName);
  const typeLabel = input.contentType === "video" ? "video" : input.contentType === "audio" ? "audio" : "article";
  const preview = input.contentPreview?.slice(0, 200) ?? "";

  sendEmailAsync({
    to: input.to,
    recipientName: who,
    subject: `${input.creatorName} published: ${input.contentTitle}`,
    idempotencyKey: `creator-broadcast-${input.contentId}-${input.to}`,
    text: `Hi ${who},\n\n${input.creatorName} just published a new ${typeLabel}: "${input.contentTitle}".\n\n${preview}\n\nRead: ${input.contentUrl}\n\n— LeptonPad`,
    html: layout(
      `New from ${input.creatorName}`,
      `<p style="color:${brand.muted};line-height:1.6">Hi ${who}, <strong style="color:${brand.ink}">${input.creatorName}</strong> just published a new ${typeLabel}.</p>
       <h2 style="color:${brand.ink};font-size:1.25rem;margin:16px 0 8px">${input.contentTitle}</h2>
       ${preview ? `<p style="color:${brand.muted};line-height:1.6">${preview}</p>` : ""}
       <p style="margin-top:24px"><a href="${input.contentUrl}" style="display:inline-block;padding:12px 24px;background:${brand.ink};color:#FFFFFF;text-decoration:none;font-weight:600;border-radius:6px">Read now</a></p>`,
    ),
  });
}
