import { and, lte, eq } from "drizzle-orm";
import { db, contentTable } from "@workspace/db";
import { getCreatorVerifiedSnapshot } from "./contentPublishSnapshot";
import { logger } from "./logger";

/** Publish content whose scheduled time has passed. */
export async function publishDueScheduledContent(): Promise<number> {
  const now = new Date();
  const due = await db
    .select()
    .from(contentTable)
    .where(
      and(
        eq(contentTable.status, "scheduled"),
        eq(contentTable.published, false),
        lte(contentTable.scheduledAt, now),
      ),
    );

  if (!due.length) return 0;

  let published = 0;

  for (const row of due) {
    const isPaid = Number(row.price) > 0;

    const updateFields: {
      published: boolean;
      status: string;
      creatorVerifiedAtPublish?: boolean;
    } = { published: true, status: "published" };

    if (isPaid && row.creatorVerifiedAtPublish == null) {
      updateFields.creatorVerifiedAtPublish = await getCreatorVerifiedSnapshot(row.creatorId);
    }

    const [updated] = await db
      .update(contentTable)
      .set(updateFields)
      .where(eq(contentTable.id, row.id))
      .returning();

    if (!updated) {
      logger.error({ contentId: row.id }, "Scheduled publish failed");
      continue;
    }

    published += 1;
  }

  return published;
}
