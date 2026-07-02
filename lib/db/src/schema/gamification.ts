import { pgTable, text, serial, integer, date, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const userStreaksTable = pgTable("user_streaks", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastReadDate: date("last_read_date"),
  totalReads: integer("total_reads").notNull().default(0),
  writerLevel: integer("writer_level").notNull().default(1),
  xp: integer("xp").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const userBadgesTable = pgTable("user_badges", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  badgeSlug: text("badge_slug").notNull(),
  earnedAt: timestamp("earned_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("user_badges_unique").on(t.userId, t.badgeSlug),
]);
