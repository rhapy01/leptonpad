/**
 * Smoke test Google SMTP email config.
 * Usage: node --experimental-strip-types artifacts/api-server/scripts/smoke-smtp.mjs [recipient@email.com]
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { sendSmtpMail } from "../src/lib/smtp.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const envPath = resolve(root, ".env");

function loadEnv() {
  if (!existsSync(envPath)) {
    console.error("Missing .env at", envPath);
    process.exit(1);
  }
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv();

const user = process.env.SMTP_USER?.trim();
const pass = process.env.SMTP_PASS?.trim();
const host = process.env.SMTP_HOST?.trim() || "smtp.gmail.com";
const port = Number(process.env.SMTP_PORT ?? "587");
const from = process.env.SMTP_FROM?.trim() || (user ? `LeptonPad <${user}>` : "LeptonPad");
const to = process.argv[2] ?? user ?? "test@example.com";

console.log("SMTP_HOST:", host);
console.log("SMTP_PORT:", port);
console.log("SMTP_USER:", user ?? "MISSING");
console.log("SMTP_PASS:", pass ? "(set)" : "MISSING");
console.log("SMTP_FROM:", from);
console.log("Recipient:", to);

if (!user || !pass) {
  console.error("\nEmail not configured. Add SMTP_USER and SMTP_PASS to .env — see .env.example");
  process.exit(1);
}

try {
  const response = await sendSmtpMail(
    { host, port, user, pass },
    {
      from,
      to,
      subject: "LeptonPad SMTP smoke test",
      text: "If you see this, Google SMTP is working.",
      html: "<p>If you see this, Google SMTP is working.</p>",
    },
  );
  console.log("\nSent:", response);
} catch (err) {
  console.error("\nSMTP send failed:", err);
  process.exit(1);
}
