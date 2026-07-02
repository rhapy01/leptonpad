import { pgTable, text, serial, numeric, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const contentTable = pgTable("content", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  type: text("type").notNull(), // 'article' | 'audio' | 'video'
  categorySlug: text("category_slug").notNull(),
  body: text("body"),
  previewText: text("preview_text"),
  coverImageUrl: text("cover_image_url"),
  audioUrl: text("audio_url"),
  videoUrl: text("video_url"),
  price: numeric("price", { precision: 18, scale: 8 }).notNull().default("0"),
  creatorId: text("creator_id").notNull(), // Clerk user ID
  viewCount: integer("view_count").notNull().default(0),
  purchaseCount: integer("purchase_count").notNull().default(0),
  featured: boolean("featured").notNull().default(false),
  published: boolean("published").notNull().default(true),
  slug: text("slug"),
  tags: text("tags").array().notNull().default([]),
  status: text("status").notNull().default("published"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  metaDescription: text("meta_description"),
  publicationId: integer("publication_id"),
  bookmarkCount: integer("bookmark_count").notNull().default(0),
  commentCount: integer("comment_count").notNull().default(0),
  reactionCount: integer("reaction_count").notNull().default(0),
  language: text("language").default("en"),
  country: text("country"),
  /** Snapshot of creator verified badge when paid content was first published — drives on-chain bps */
  creatorVerifiedAtPublish: boolean("creator_verified_at_publish"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertContentSchema = createInsertSchema(contentTable).omit({ id: true, createdAt: true, updatedAt: true, viewCount: true, purchaseCount: true });
export type InsertContent = z.infer<typeof insertContentSchema>;
export type Content = typeof contentTable.$inferSelect;
