import { pushSchema } from "drizzle-kit/api";
import { db, pool } from "./index";
import * as schema from "./schema";

async function main() {
  console.log("Pushing schema to database...");
  const { apply } = await pushSchema(schema, db);
  await apply();
  console.log("Schema push complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
