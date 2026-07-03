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
  await pool.query(`SELECT count(*)::int AS unlocks, coalesce(sum(amount),0)::float AS usdc FROM payments`)
).rows;
const [content] = (
  await pool.query(
    `SELECT count(*)::int AS total, count(*) filter (where published=true)::int AS published FROM content`,
  )
).rows;
const [creators] = (
  await pool.query(
    `SELECT count(distinct creator_id)::int AS creators FROM content WHERE published=true`,
  )
).rows;
const [users] = (await pool.query(`SELECT count(*)::int AS users FROM users`)).rows;
const [avg] = (
  await pool.query(`SELECT coalesce(avg(amount),0)::float AS avg_price FROM payments`)
).rows;

console.log(
  JSON.stringify(
    {
      paidUnlocks: payments.unlocks,
      totalUsdcPaid: payments.usdc,
      publishedContent: content.published,
      totalContent: content.total,
      publishingCreators: creators.creators,
      registeredUsers: users.users,
      avgPricePerUnlock: Number(avg.avg_price.toFixed(4)),
    },
    null,
    2,
  ),
);

await pool.end();
