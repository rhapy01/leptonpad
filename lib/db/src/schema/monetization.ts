import { pgTable, text, serial, integer, numeric, boolean, timestamp } from "drizzle-orm/pg-core";

/** One-time USDC tips — fits per-piece micropayment model (no subscriptions). */
export const tipsTable = pgTable("tips", {
  id: serial("id").primaryKey(),
  fromUserId: text("from_user_id").notNull(),
  toCreatorId: text("to_creator_id").notNull(),
  contentId: integer("content_id"),
  amount: numeric("amount", { precision: 18, scale: 8 }).notNull(),
  creatorAmount: numeric("creator_amount", { precision: 18, scale: 8 }),
  platformAmount: numeric("platform_amount", { precision: 18, scale: 8 }),
  message: text("message"),
  txHash: text("tx_hash"),
  splitTxHash: text("split_tx_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adCampaignsTable = pgTable("ad_campaigns", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  advertiser: text("advertiser").notNull(),
  imageUrl: text("image_url"),
  targetUrl: text("target_url").notNull(),
  categorySlug: text("category_slug"),
  active: boolean("active").notNull().default(true),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  submissionId: integer("submission_id"),
  impressionCount: integer("impression_count").notNull().default(0),
  clickCount: integer("click_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adSubmissionStatusEnum = ["pending", "approved", "rejected"] as const;
export type AdSubmissionStatus = (typeof adSubmissionStatusEnum)[number];

export const adSubmissionsTable = pgTable("ad_submissions", {
  id: serial("id").primaryKey(),
  submitterUserId: text("submitter_user_id"),
  contactName: text("contact_name"),
  contactEmail: text("contact_email").notNull(),
  businessName: text("business_name").notNull(),
  headline: text("headline").notNull(),
  targetUrl: text("target_url").notNull(),
  imageUrl: text("image_url").notNull(),
  durationDays: integer("duration_days").notNull(),
  categorySlug: text("category_slug"),
  status: text("status").notNull().default("pending"),
  adminNote: text("admin_note"),
  reviewedByClerkId: text("reviewed_by_clerk_id"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  campaignId: integer("campaign_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adImpressionsTable = pgTable("ad_impressions", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  userId: text("user_id"),
  contentId: integer("content_id"),
  clicked: boolean("clicked").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
