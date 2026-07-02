import { db, usersTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const email = (process.argv[2] ?? "akintoyeisaac5@gmail.com").trim().toLowerCase();

const [updated] = await db
  .update(usersTable)
  .set({ isAdmin: true })
  .where(sql`lower(${usersTable.email}) = ${email}`)
  .returning({
    clerkId: usersTable.clerkId,
    email: usersTable.email,
    name: usersTable.name,
    isAdmin: usersTable.isAdmin,
  });

if (!updated) {
  console.error(`No user with email ${email}. Sign in once, then re-run.`);
  process.exit(1);
}

console.log("Admin granted:", updated);
