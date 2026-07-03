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
  purpose text NOT NULL DEFAULT 'device',
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS device_otps_clerk_idx ON device_otps (clerk_id);
ALTER TABLE device_otps ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'device';

CREATE TABLE IF NOT EXISTS wallet_passkeys (
  id serial PRIMARY KEY,
  clerk_id text NOT NULL,
  credential_id text NOT NULL,
  public_key text NOT NULL,
  counter integer NOT NULL DEFAULT 0,
  device_type text,
  backed_up boolean,
  transports text[],
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS wallet_passkeys_credential_uidx ON wallet_passkeys (credential_id);
CREATE INDEX IF NOT EXISTS wallet_passkeys_clerk_idx ON wallet_passkeys (clerk_id);

CREATE TABLE IF NOT EXISTS wallet_passkey_challenges (
  clerk_id text PRIMARY KEY,
  challenge text NOT NULL,
  purpose text NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS media_uploads (
  id serial PRIMARY KEY,
  user_id text NOT NULL,
  filename text NOT NULL,
  original_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL,
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS media_uploads_user_idx ON media_uploads (user_id);
`;

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query(sql);
  console.log("Security schema applied.");
} finally {
  await pool.end();
}
