/**
 * Apply security schema changes (idempotent). Run: node scripts/push-security-schema.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

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

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL required");
  process.exit(1);
}

const sql = `
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret_encrypted text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_pin_hash text;

CREATE TABLE IF NOT EXISTS trusted_devices (
  id serial PRIMARY KEY,
  clerk_id text NOT NULL,
  device_hash text NOT NULL,
  label text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS trusted_devices_clerk_device_uidx ON trusted_devices (clerk_id, device_hash);
CREATE INDEX IF NOT EXISTS trusted_devices_clerk_idx ON trusted_devices (clerk_id);

CREATE TABLE IF NOT EXISTS device_otps (
  id serial PRIMARY KEY,
  clerk_id text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS device_otps_clerk_idx ON device_otps (clerk_id);
`;

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query(sql);
  console.log("Security schema applied.");
} finally {
  await pool.end();
}
