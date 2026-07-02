import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";

/** Literary competitions (optional — not seeded by default). */
export const competitionsTable = pgTable("competitions", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull(),
  theme: text("theme").notNull(),
  region: text("region"),
  language: text("language").default("en"),
  prizeDescription: text("prize_description"),
  deadline: timestamp("deadline", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("open"),
  coverImageUrl: text("cover_image_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const competitionEntriesTable = pgTable("competition_entries", {
  id: serial("id").primaryKey(),
  competitionId: integer("competition_id").notNull(),
  userId: text("user_id").notNull(),
  contentId: integer("content_id"),
  title: text("title").notNull(),
  excerpt: text("excerpt"),
  status: text("status").notNull().default("submitted"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Rights & licensing for adaptations (film, translation, audio). */
export const contentRightsTable = pgTable("content_rights", {
  id: serial("id").primaryKey(),
  contentId: integer("content_id").notNull(),
  ownerId: text("owner_id").notNull(),
  rightsType: text("rights_type").notNull(),
  territory: text("territory"),
  language: text("language"),
  status: text("status").notNull().default("available"),
  licenseTerms: text("license_terms"),
  contactEmail: text("contact_email"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rightsInquiriesTable = pgTable("rights_inquiries", {
  id: serial("id").primaryKey(),
  rightsId: integer("rights_id").notNull(),
  inquirerId: text("inquirer_id").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
