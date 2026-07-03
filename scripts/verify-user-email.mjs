import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/verify-user-email.mjs <email>");
  process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(resolve(root, "lib/db/package.json"));
const pg = require("pg");

const envPath = resolve(root, ".env");
if (existsSync(envPath) && !process.env.DATABASE_URL) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const r = await pool.query(
  `UPDATE users SET verified = true WHERE email = $1 RETURNING clerk_id, email, name, is_admin, verified`,
  [email.toLowerCase()],
);
if (r.rows.length === 0) {
  console.error(`No user found for ${email}`);
  process.exit(1);
}
console.log("Verified:", r.rows[0]);
await pool.end();
