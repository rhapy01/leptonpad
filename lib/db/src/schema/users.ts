import { pgTable, text, serial, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id").notNull().unique(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  imageUrl: text("image_url"),
  bannerUrl: text("banner_url"),
  walletAddress: text("wallet_address"),
  /** AES-256-GCM encrypted testnet private key — in-app wallet (hackathon demo). */
  walletEncryptedKey: text("wallet_encrypted_key"),
  walletGatewayReady: boolean("wallet_gateway_ready").notNull().default(false),
  selectedCategories: text("selected_categories").array().notNull().default([]),
  onboardingComplete: boolean("onboarding_complete").notNull().default(false),
  verified: boolean("verified").notNull().default(false),
  isAdmin: boolean("is_admin").notNull().default(false),
  bio: text("bio"),
  website: text("website"),
  twitterUrl: text("twitter_url"),
  linkedinUrl: text("linkedin_url"),
  country: text("country"),
  language: text("language").default("en"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
