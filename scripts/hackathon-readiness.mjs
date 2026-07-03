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

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const [payments] = (
  await pool.query(`
    select
      count(*)::int as total,
      count(*) filter (where split_tx_hash is not null and split_tx_hash not like 'mock%')::int as on_chain_splits
    from payments
  `)
).rows;

const [tips] = (await pool.query(`select count(*)::int as total from tips`)).rows;

const types = (
  await pool.query(
    `select type, count(*)::int as count from content where published = true group by type order by type`,
  )
).rows;

const [views] = (
  await pool.query(`select count(*)::int as total from unique_views`)
).rows;

const paidWithViews = (
  await pool.query(`
    select count(distinct p.content_id)::int as paid_content_unlocked
    from payments p
  `)
).rows[0];

console.log(
  JSON.stringify(
    {
      payments,
      tips,
      contentByType: types,
      totalViews: views.total,
      paidContentPiecesUnlocked: paidWithViews.paid_content_unlocked,
      conversionNote:
        views.total > 0
          ? `${((payments.total / views.total) * 100).toFixed(1)}% unlocks/views (rough)`
          : "N/A — no view data",
    },
    null,
    2,
  ),
);

await pool.end();
