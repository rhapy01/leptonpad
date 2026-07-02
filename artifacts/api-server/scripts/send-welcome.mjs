/**
 * Send welcome email using the app template.
 * Usage: npx tsx artifacts/api-server/scripts/send-welcome.mjs [email] [name]
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const envPath = resolve(root, ".env");

function loadEnv() {
  if (!existsSync(envPath)) return;
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

const to = process.argv[2] ?? "akintoyeisaac5@gmail.com";
const name = process.argv[3] ?? "Isaac Akintoye";

const { sendEmail, isEmailConfigured, buildWelcomeEmail } = await import("../src/lib/email.ts");

if (!isEmailConfigured()) {
  console.error("SMTP not configured");
  process.exit(1);
}

console.log("Sending welcome email to", to);
const ok = await sendEmail(buildWelcomeEmail(to, name));
console.log(ok ? "Sent successfully" : "Send failed");
process.exit(ok ? 0 : 1);
