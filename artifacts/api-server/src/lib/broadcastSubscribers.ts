import { eq } from "drizzle-orm";
import { db, followsTable, usersTable } from "@workspace/db";
import { sendCreatorNewWorkEmail } from "./email";
import { logger } from "./logger";

export interface BroadcastContent {
  id: number;
  title: string;
  previewText: string | null;
  type: string;
}

/** Email all profile subscribers (follows) about new published work. */
export async function notifySubscribersOfNewContent(
  creatorId: string,
  content: BroadcastContent,
): Promise<{ emailed: number; subscriberCount: number }> {
  const subscribers = await db
    .select({ followerId: followsTable.followerId })
    .from(followsTable)
    .where(eq(followsTable.creatorId, creatorId));

  if (!subscribers.length) {
    return { emailed: 0, subscriberCount: 0 };
  }

  const [creator] = await db
    .select({ name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.clerkId, creatorId))
    .limit(1);

  const creatorName = creator?.name ?? "A creator";
  const baseUrl = process.env.PUBLIC_URL ?? process.env.APP_URL ?? "http://localhost:25139";
  const contentUrl = `${baseUrl}/content/${content.id}`;

  let emailed = 0;

  for (const sub of subscribers) {
    const [reader] = await db
      .select({ email: usersTable.email, name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.clerkId, sub.followerId))
      .limit(1);

    if (!reader?.email) continue;

    sendCreatorNewWorkEmail({
      to: reader.email,
      readerName: reader.name,
      creatorName,
      contentTitle: content.title,
      contentPreview: content.previewText,
      contentType: content.type,
      contentUrl,
      contentId: content.id,
    });
    emailed += 1;
  }

  logger.info(
    { creatorId, contentId: content.id, emailed, subscriberCount: subscribers.length },
    "Subscriber broadcast emails queued",
  );

  return { emailed, subscriberCount: subscribers.length };
}
