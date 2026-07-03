/**
 * Apply social schema changes (idempotent). Run: node scripts/push-social-schema.mjs
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
CREATE TABLE IF NOT EXISTS reading_progress (
  id serial PRIMARY KEY,
  user_id text NOT NULL,
  content_id integer NOT NULL,
  progress_pct integer NOT NULL DEFAULT 0,
  scroll_position integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS reading_progress_unique ON reading_progress (user_id, content_id);
`;

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query(sql);
  console.log("Social schema applied.");
} finally {
  await pool.end();
}
