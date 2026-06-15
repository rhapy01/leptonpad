import { pgTable, text, serial, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const aiSuggestionsTable = pgTable("ai_suggestions", {
  id: serial("id").primaryKey(),
  contentId: integer("content_id").notNull(),
  creatorId: text("creator_id").notNull(),
  currentPrice: numeric("current_price", { precision: 18, scale: 8 }).notNull(),
  suggestedPrice: numeric("suggested_price", { precision: 18, scale: 8 }).notNull(),
  action: text("action").notNull(), // 'raise' | 'lower' | 'keep'
  reasoning: text("reasoning").notNull(),
  conversionRate: numeric("conversion_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("pending"), // 'pending' | 'applied' | 'dismissed'
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAiSuggestionSchema = createInsertSchema(aiSuggestionsTable).omit({ id: true, createdAt: true });
export type InsertAiSuggestion = z.infer<typeof insertAiSuggestionSchema>;
export type AiSuggestion = typeof aiSuggestionsTable.$inferSelect;
