import { pgTable, text, serial, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  contentId: integer("content_id").notNull(),
  readerId: text("reader_id").notNull(), // Clerk user ID
  creatorId: text("creator_id").notNull(), // Clerk user ID
  amount: numeric("amount", { precision: 18, scale: 8 }).notNull(),
  creatorAmount: numeric("creator_amount", { precision: 18, scale: 8 }).notNull(),
  platformAmount: numeric("platform_amount", { precision: 18, scale: 8 }).notNull(),
  txHash: text("tx_hash"),
  /** On-chain LeptonSplit tx — atomic creator/platform disbursement */
  splitTxHash: text("split_tx_hash"),
  paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({ id: true, paidAt: true });
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof paymentsTable.$inferSelect;
