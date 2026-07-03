/**
 * Apply ad campaign schema changes (idempotent). Run: node scripts/push-ads-schema.mjs
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
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS submission_id integer;

CREATE TABLE IF NOT EXISTS ad_submissions (
  id serial PRIMARY KEY,
  submitter_user_id text,
  contact_name text,
  contact_email text NOT NULL,
  business_name text NOT NULL,
  headline text NOT NULL,
  target_url text NOT NULL,
  image_url text NOT NULL,
  duration_days integer NOT NULL,
  category_slug text,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  reviewed_by_clerk_id text,
  reviewed_at timestamptz,
  campaign_id integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ad_submissions_status_idx ON ad_submissions (status);
CREATE INDEX IF NOT EXISTS ad_submissions_created_idx ON ad_submissions (created_at DESC);
CREATE INDEX IF NOT EXISTS ad_campaigns_expires_idx ON ad_campaigns (expires_at);
`;

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
await pool.query(sql);
await pool.end();
console.log("Ad schema applied.");
