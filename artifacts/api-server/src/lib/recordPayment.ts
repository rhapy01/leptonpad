import { and, eq, desc } from "drizzle-orm";
import { db, contentTable, paymentsTable, usersTable, type Payment } from "@workspace/db";
import {
  sendCreatorSaleEmail,
  sendPurchaseReceiptEmail,
} from "./email";
import { creatorShareForVerified } from "./creatorShare";
import { verifiedAtPublishForContent } from "./contentPublishSnapshot";
import { logger } from "./logger";
import {
  ensureContentRegisteredOnChain,
  executeAtomicContentSplit,
  requiresAtomicSplit,
} from "./leptonSplit";
import { SettlementIncompleteError } from "./settlementErrors";

export interface RecordPaymentInput {
  contentId: number;
  readerId: string;
  txHash?: string | null;
  /** Amount verified by x402 — defaults to content list price */
  amountUsdc?: number;
}

export interface RecordPaymentResult {
  paymentId: number;
  contentId: number;
  amountPaid: number;
  creatorReceives: number;
  settledAt: string;
  alreadyExisted: boolean;
  txHash?: string | null;
  splitTxHash?: string | null;
  /** Gateway charge recorded; on-chain creator split still in progress */
  splitPending?: boolean;
}

export function paymentGrantsAccess(
  payment:
    | Pick<Payment, "splitTxHash" | "txHash">
    | string
    | null
    | undefined,
): boolean {
  if (!requiresAtomicSplit()) return true;

  const row =
    payment != null && typeof payment === "object" && "txHash" in payment
      ? payment
      : { splitTxHash: payment as string | null | undefined, txHash: null as string | null };

  if (row.splitTxHash) return true;
  const tx = row.txHash;
  return !!tx && !String(tx).startsWith("mock-");
}

export function isPendingPayment(row: Pick<Payment, "splitTxHash" | "txHash">): boolean {
  return requiresAtomicSplit() && !!row.txHash && !row.splitTxHash;
}

export async function tryCompletePendingSplit(
  contentId: number,
  readerId: string,
): Promise<RecordPaymentResult | null> {
  const existing = await db
    .select()
    .from(paymentsTable)
    .where(
      and(
        eq(paymentsTable.contentId, contentId),
        eq(paymentsTable.readerId, readerId),
      ),
    )
    .limit(1);

  if (!existing.length || !isPendingPayment(existing[0])) {
    return null;
  }

  return recordContentPayment({
    contentId,
    readerId,
    txHash: existing[0].txHash,
    amountUsdc: Number(existing[0].amount),
  });
}

/** Finish pending creator splits (Gateway batch landed but split not yet executed). */
export async function tryCompleteCreatorPendingSplits(
  creatorId: string,
  limit = 8,
): Promise<number> {
  if (!requiresAtomicSplit()) return 0;

  const pending = await db
    .select()
    .from(paymentsTable)
    .where(eq(paymentsTable.creatorId, creatorId))
    .orderBy(desc(paymentsTable.paidAt))
    .limit(50);

  const toRetry = pending.filter((p) => isPendingPayment(p)).slice(0, limit);
  let completed = 0;

  for (const row of toRetry) {
    try {
      const result = await recordContentPayment({
        contentId: row.contentId,
        readerId: row.readerId,
        txHash: row.txHash,
        amountUsdc: Number(row.amount),
      });
      if (result?.splitTxHash) completed += 1;
    } catch (err) {
      logger.warn(
        { paymentId: row.id, contentId: row.contentId, err },
        "Background split completion attempt failed",
      );
    }
  }

  return completed;
}

async function finalizeSplit(
  input: {
    contentId: number;
    readerId: string;
    content: typeof contentTable.$inferSelect;
    price: number;
    verified: boolean;
    txHash: string;
    existingRow?: Payment;
  },
): Promise<RecordPaymentResult> {
  const creatorShare = creatorShareForVerified(input.verified);
  const creatorAmount = input.price * creatorShare;
  const platformAmount = input.price * (1 - creatorShare);

  let row = input.existingRow;
  const hadSplit = !!row?.splitTxHash;

  if (!row) {
    const [inserted] = await db
      .insert(paymentsTable)
      .values({
        contentId: input.contentId,
        readerId: input.readerId,
        creatorId: input.content.creatorId,
        amount: String(input.price),
        creatorAmount: String(creatorAmount),
        platformAmount: String(platformAmount),
        txHash: input.txHash,
        splitTxHash: null,
      })
      .returning();
    row = inserted;
  } else if (!row.txHash) {
    const [updated] = await db
      .update(paymentsTable)
      .set({ txHash: input.txHash })
      .where(eq(paymentsTable.id, row.id))
      .returning();
    row = updated;
  }

  if (row.splitTxHash) {
    return {
      paymentId: row.id,
      contentId: input.contentId,
      amountPaid: Number(row.amount),
      creatorReceives: Number(row.creatorAmount),
      settledAt: row.paidAt.toISOString(),
      alreadyExisted: true,
      txHash: row.txHash,
      splitTxHash: row.splitTxHash,
      splitPending: false,
    };
  }

  let splitTxHash: string | null = null;
  let splitPending = false;

  try {
    await ensureContentRegisteredOnChain({
      contentId: input.contentId,
      creatorId: input.content.creatorId,
      verified: input.verified,
    });

    const split = await executeAtomicContentSplit(
      input.contentId,
      input.price,
      input.txHash,
      { maxAttempts: 20 },
    );

    if (split.ok && split.splitTxHash) {
      splitTxHash = split.splitTxHash;
    } else {
      splitPending = true;
      logger.warn(
        { contentId: input.contentId, reason: split.reason },
        "Gateway payment recorded; on-chain split still landing",
      );
    }
  } catch (err) {
    splitPending = true;
    logger.error(
      { err, contentId: input.contentId },
      "On-chain split deferred after Gateway payment",
    );
  }

  const [payment] = await db
    .update(paymentsTable)
    .set({ splitTxHash })
    .where(eq(paymentsTable.id, row.id))
    .returning();

  if (!hadSplit) {
    await db
      .update(contentTable)
      .set({ purchaseCount: input.content.purchaseCount + 1 })
      .where(eq(contentTable.id, input.contentId));
  }

  if (!hadSplit) {
    void notifyPaymentEmails({
      readerId: input.readerId,
      creatorId: input.content.creatorId,
      contentTitle: input.content.title,
      paymentId: payment.id,
      amountPaid: Number(payment.amount),
      creatorReceives: Number(payment.creatorAmount),
    });
  }

  if (!hadSplit && splitPending && payment.txHash) {
    void tryCompletePendingSplit(input.contentId, input.readerId).catch((err) => {
      logger.warn({ err, contentId: input.contentId }, "Deferred split retry failed");
    });
  }

  return {
    paymentId: payment.id,
    contentId: input.contentId,
    amountPaid: Number(payment.amount),
    creatorReceives: Number(payment.creatorAmount),
    settledAt: payment.paidAt.toISOString(),
    alreadyExisted: hadSplit,
    txHash: payment.txHash,
    splitTxHash: payment.splitTxHash,
    splitPending,
  };
}

export async function recordContentPayment(
  input: RecordPaymentInput,
): Promise<RecordPaymentResult | null> {
  const items = await db
    .select()
    .from(contentTable)
    .where(eq(contentTable.id, input.contentId))
    .limit(1);

  if (!items.length) return null;

  const content = items[0];
  const price = Number(content.price);

  if (price === 0) {
    return {
      paymentId: 0,
      contentId: input.contentId,
      amountPaid: 0,
      creatorReceives: 0,
      settledAt: new Date().toISOString(),
      alreadyExisted: false,
    };
  }

  if (input.amountUsdc != null && Math.abs(input.amountUsdc - price) > 0.01) {
    logger.warn(
      { contentId: input.contentId, paid: input.amountUsdc, listed: price },
      "x402 paid amount differs from content list price — using list price for split",
    );
  }

  const existing = await db
    .select()
    .from(paymentsTable)
    .where(
      and(
        eq(paymentsTable.contentId, input.contentId),
        eq(paymentsTable.readerId, input.readerId),
      ),
    )
    .limit(1);

  const verifiedAtPublish = verifiedAtPublishForContent(content);

  if (existing.length > 0) {
    const row = existing[0];

    if (paymentGrantsAccess(row)) {
      return {
        paymentId: row.id,
        contentId: input.contentId,
        amountPaid: Number(row.amount),
        creatorReceives: Number(row.creatorAmount),
        settledAt: row.paidAt.toISOString(),
        alreadyExisted: true,
        txHash: row.txHash,
        splitTxHash: row.splitTxHash,
        splitPending: isPendingPayment(row),
      };
    }

    const settlementRef = input.txHash ?? row.txHash;
    if (!settlementRef) {
      throw new SettlementIncompleteError(
        "Payment is pending but settlement reference is missing. Contact support.",
      );
    }

    return finalizeSplit({
      contentId: input.contentId,
      readerId: input.readerId,
      content,
      price,
      verified: verifiedAtPublish,
      txHash: settlementRef,
      existingRow: row,
    });
  }

  if (!input.txHash) {
    throw new SettlementIncompleteError("Missing x402 settlement reference");
  }

  return finalizeSplit({
    contentId: input.contentId,
    readerId: input.readerId,
    content,
    price,
    verified: verifiedAtPublish,
    txHash: input.txHash,
  });
}

export function toUnlockResult(result: RecordPaymentResult) {
  return {
    success: true,
    paymentId: result.paymentId,
    contentId: result.contentId,
    amountPaid: result.amountPaid,
    creatorReceives: result.creatorReceives,
    settledAt: result.settledAt,
    alreadyOwned: result.alreadyExisted,
    txHash: result.txHash ?? null,
    splitTxHash: result.splitTxHash ?? null,
    splitPending: result.splitPending ?? isPendingPayment({
      splitTxHash: result.splitTxHash ?? null,
      txHash: result.txHash ?? null,
    }),
    settlementNetwork: result.txHash || result.splitTxHash ? "arc-testnet" : null,
  };
}

async function notifyPaymentEmails(input: {
  readerId: string;
  creatorId: string;
  contentTitle: string;
  paymentId: number;
  amountPaid: number;
  creatorReceives: number;
}): Promise<void> {
  try {
    const readerRows = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.clerkId, input.readerId))
      .limit(1);
    const reader = readerRows[0];
    const creatorRows = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.clerkId, input.creatorId))
      .limit(1);
    const creator = creatorRows[0];

    if (reader?.email) {
      sendPurchaseReceiptEmail({
        to: reader.email,
        readerName: reader.name,
        contentTitle: input.contentTitle,
        amountPaid: input.amountPaid,
        paymentId: input.paymentId,
      });
    }

    if (creator?.email && creator.clerkId !== input.readerId) {
      sendCreatorSaleEmail({
        to: creator.email,
        creatorName: creator.name,
        contentTitle: input.contentTitle,
        creatorReceives: input.creatorReceives,
        verified: creator.verified,
      });
    }
  } catch (err) {
    logger.error({ err }, "Payment email notification failed");
  }
}
