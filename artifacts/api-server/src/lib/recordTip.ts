import { eq } from "drizzle-orm";
import { db, tipsTable, usersTable } from "@workspace/db";
import { creatorShareForVerified, creatorShareLabel } from "./creatorShare";
import {
  executeAtomicTipSplit,
  registerTipCreatorOnChain,
  requiresAtomicSplit,
} from "./leptonSplit";
import { SettlementIncompleteError } from "./settlementErrors";

export interface RecordTipInput {
  fromUserId: string;
  toCreatorId: string;
  amount: number;
  message?: string | null;
  contentId?: number | null;
  txHash?: string | null;
}

function tipResponse(tip: typeof tipsTable.$inferSelect, verified: boolean) {
  return {
    id: tip.id,
    amount: Number(tip.amount),
    creatorAmount: Number(tip.creatorAmount),
    creatorShare: creatorShareLabel(verified),
    verified,
    toCreatorId: tip.toCreatorId,
    message: tip.message,
    txHash: tip.txHash,
    splitTxHash: tip.splitTxHash,
    settledAt: tip.createdAt.toISOString(),
  };
}

export async function recordTip(input: RecordTipInput) {
  if (input.txHash) {
    const prior = await db
      .select()
      .from(tipsTable)
      .where(eq(tipsTable.txHash, input.txHash))
      .limit(1);
    if (prior.length > 0) {
      const row = prior[0];
      if (row.splitTxHash || !requiresAtomicSplit()) {
        const creatorRows = await db
          .select({ verified: usersTable.verified })
          .from(usersTable)
          .where(eq(usersTable.clerkId, input.toCreatorId))
          .limit(1);
        return tipResponse(row, creatorRows[0]?.verified ?? false);
      }
      input = { ...input, amount: Number(row.amount) };
    }
  }

  const creatorRows = await db
    .select({ verified: usersTable.verified })
    .from(usersTable)
    .where(eq(usersTable.clerkId, input.toCreatorId))
    .limit(1);
  const verified = creatorRows[0]?.verified ?? false;
  const share = creatorShareForVerified(verified);
  const creatorAmount = input.amount * share;
  const platformAmount = input.amount * (1 - share);

  const creatorWallet = await registerTipCreatorOnChain(input.toCreatorId, verified);
  if (!creatorWallet && requiresAtomicSplit()) {
    throw new SettlementIncompleteError("Creator tip wallet not available for split");
  }

  if (!input.txHash && requiresAtomicSplit()) {
    throw new SettlementIncompleteError("Missing x402 settlement reference for tip");
  }

  let tipRow = input.txHash
    ? (
        await db
          .select()
          .from(tipsTable)
          .where(eq(tipsTable.txHash, input.txHash))
          .limit(1)
      )[0]
    : undefined;

  if (!tipRow) {
    const [inserted] = await db
      .insert(tipsTable)
      .values({
        fromUserId: input.fromUserId,
        toCreatorId: input.toCreatorId,
        contentId: input.contentId ?? null,
        amount: String(input.amount),
        creatorAmount: String(creatorAmount),
        platformAmount: String(platformAmount),
        message: input.message ?? null,
        txHash: input.txHash ?? null,
        splitTxHash: null,
      })
      .returning();
    tipRow = inserted;
  }

  if (creatorWallet) {
    const split = await executeAtomicTipSplit(
      creatorWallet,
      input.amount,
      input.txHash,
    );
    if (requiresAtomicSplit() && (!split.ok || !split.splitTxHash)) {
      throw new SettlementIncompleteError(
        split.reason ?? "On-chain tip split did not complete",
      );
    }

    if (split.splitTxHash && !tipRow.splitTxHash) {
      const [updated] = await db
        .update(tipsTable)
        .set({ splitTxHash: split.splitTxHash })
        .where(eq(tipsTable.id, tipRow.id))
        .returning();
      tipRow = updated;
    }
  }

  return tipResponse(tipRow, verified);
}
