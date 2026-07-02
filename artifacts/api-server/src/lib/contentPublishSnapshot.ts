import { eq } from "drizzle-orm";
import { db, usersTable, type Content } from "@workspace/db";

/** Creator verification status at the moment paid content was first published. */
export async function getCreatorVerifiedSnapshot(creatorId: string): Promise<boolean> {
  const rows = await db
    .select({ verified: usersTable.verified })
    .from(usersTable)
    .where(eq(usersTable.clerkId, creatorId))
    .limit(1);
  return rows[0]?.verified ?? false;
}

export function verifiedAtPublishForContent(
  content: Pick<Content, "creatorVerifiedAtPublish">,
): boolean {
  return content.creatorVerifiedAtPublish ?? false;
}
