/**
 * Grant isAdmin for all INITIAL_ADMIN_EMAILS (and optional CLI emails).
 * Usage: node scripts/grant-admin-emails.mjs [extra@email.com]
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(resolve(root, "lib/db/package.json"));
const pg = require("pg");

const envPath = resolve(root, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL required");
  process.exit(1);
}

const emails = new Set(
  `${process.env.INITIAL_ADMIN_EMAILS ?? ""},${process.argv.slice(2).join(",")}`
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

if (emails.size === 0) {
  console.error("No emails — set INITIAL_ADMIN_EMAILS or pass addresses as args");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
console.log("Granting admin to:", [...emails].join(", "));

for (const email of emails) {
  const result = await pool.query(
    `UPDATE users SET is_admin = true WHERE lower(email) = $1
     RETURNING clerk_id, email, name, is_admin`,
    [email],
  );
  if (result.rowCount === 0) {
    console.warn(`  — no user row yet for ${email} (sign in once, then re-run)`);
  } else {
    for (const row of result.rows) console.log("  ✓", row);
  }
}

await pool.end();
