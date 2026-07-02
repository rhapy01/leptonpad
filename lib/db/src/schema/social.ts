import { pgTable, text, serial, integer, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const followsTable = pgTable("follows", {
  id: serial("id").primaryKey(),
  followerId: text("follower_id").notNull(),
  creatorId: text("creator_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("follows_unique").on(t.followerId, t.creatorId),
]);

export const commentsTable = pgTable("comments", {
  id: serial("id").primaryKey(),
  contentId: integer("content_id").notNull(),
  userId: text("user_id").notNull(),
  body: text("body").notNull(),
  parentId: integer("parent_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reactionsTable = pgTable("reactions", {
  id: serial("id").primaryKey(),
  contentId: integer("content_id").notNull(),
  userId: text("user_id").notNull(),
  type: text("type").notNull().default("clap"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("reactions_unique").on(t.contentId, t.userId),
]);

export const collectionsTable = pgTable("collections", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const collectionItemsTable = pgTable("collection_items", {
  id: serial("id").primaryKey(),
  collectionId: integer("collection_id").notNull(),
  contentId: integer("content_id").notNull(),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("collection_items_unique").on(t.collectionId, t.contentId),
]);

export const readingProgressTable = pgTable("reading_progress", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  contentId: integer("content_id").notNull(),
  progressPct: integer("progress_pct").notNull().default(0),
  scrollPosition: integer("scroll_position").notNull().default(0),
  completed: boolean("completed").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  uniqueIndex("reading_progress_unique").on(t.userId, t.contentId),
]);

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  type: text("type").notNull(),
  message: text("message").notNull(),
  link: text("link"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contentReportsTable = pgTable("content_reports", {
  id: serial("id").primaryKey(),
  contentId: integer("content_id").notNull(),
  reporterId: text("reporter_id").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const publicationsTable = pgTable("publications", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  coverImageUrl: text("cover_image_url"),
  ownerId: text("owner_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const publicationMembersTable = pgTable("publication_members", {
  id: serial("id").primaryKey(),
  publicationId: integer("publication_id").notNull(),
  userId: text("user_id").notNull(),
  role: text("role").notNull().default("writer"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("publication_members_unique").on(t.publicationId, t.userId),
]);

export const contentVersionsTable = pgTable("content_versions", {
  id: serial("id").primaryKey(),
  contentId: integer("content_id").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const uniqueViewsTable = pgTable("unique_views", {
  id: serial("id").primaryKey(),
  contentId: integer("content_id").notNull(),
  viewerId: text("viewer_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("unique_views_unique").on(t.contentId, t.viewerId),
]);

export const insertFollowSchema = createInsertSchema(followsTable).omit({ id: true, createdAt: true });
export type InsertFollow = z.infer<typeof insertFollowSchema>;
