import { db, notificationsTable } from "@workspace/db";

export async function createUserNotification(input: {
  userId: string;
  type: string;
  message: string;
  link?: string | null;
}): Promise<void> {
  await db.insert(notificationsTable).values({
    userId: input.userId,
    type: input.type,
    message: input.message,
    link: input.link ?? null,
  });
}
