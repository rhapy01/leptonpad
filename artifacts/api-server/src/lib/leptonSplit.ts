import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  parseUnits,
  toBytes,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { eq, and, sql } from "drizzle-orm";
import { db, usersTable, contentTable } from "@workspace/db";
import { leptonSplitAbi } from "../contracts/leptonSplitAbi";
import { arcTestnet } from "./arcChain";
import { provisionUserWallet, deriveWalletAddress } from "./appWallet";
import { isMockPayments } from "./gateway";
import { logger } from "./logger";
import { SettlementIncompleteError, CreatorWalletRequiredError, type CreatorVerifyOnChainSync } from "./settlementErrors";
import { isSystemCreator } from "./systemCreator";

const SPLIT_RETRY_ATTEMPTS = 20;
const SPLIT_RETRY_INITIAL_MS = 2_000;
const SPLIT_RETRY_MAX_MS = 8_000;

export function getPlatformWalletAddress(): Address | null {
  const addr = process.env.PLATFORM_WALLET_ADDRESS;
  return addr ? (addr as Address) : null;
}

/** x402 payTo / Gateway seller — the LeptonSplit contract on Arc testnet. */
export function getSplitContractAddress(): Address | null {
  const addr = process.env.LEPTON_SPLIT_CONTRACT ?? process.env.GATEWAY_SELLER_ADDRESS;
  return addr ? (addr as Address) : null;
}

export function requiresAtomicSplit(): boolean {
  return !isMockPayments() && !!getSplitContractAddress() && !!getOwnerPrivateKey();
}

function getOwnerPrivateKey(): Hex | null {
  const raw =
    process.env.SPLIT_OWNER_PRIVATE_KEY ??
    process.env.TREASURY_PRIVATE_KEY ??
    process.env.PRIVATE_KEYS;
  if (!raw) return null;
  const key = raw.startsWith("0x") ? raw : `0x${raw}`;
  return key as Hex;
}

function getPublicClient() {
  return createPublicClient({ chain: arcTestnet, transport: http() });
}

function getOwnerWalletClient() {
  const key = getOwnerPrivateKey();
  if (!key) throw new Error("SPLIT_OWNER_PRIVATE_KEY or TREASURY_PRIVATE_KEY required");
  const account = privateKeyToAccount(key);
  return createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(),
  });
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(attempt: number): number {
  const delay = SPLIT_RETRY_INITIAL_MS * Math.pow(1.4, attempt);
  return Math.min(Math.round(delay), SPLIT_RETRY_MAX_MS);
}

function isRetryableSplitError(message: string): boolean {
  const lower = message.toLowerCase();
  if (lower.includes("content not registered")) return false;
  if (lower.includes("settlement used")) return false;
  if (lower.includes("not owner")) return false;
  if (lower.includes("zero settlement")) return false;
  if (lower.includes("no-split-contract")) return false;
  if (lower.includes("no-split-owner-key")) return false;
  if (lower.includes("transfer failed")) return false;

  return (
    lower.includes("insufficient balance") ||
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("network") ||
    lower.includes("fetch") ||
    lower.includes("econnreset") ||
    lower.includes("429") ||
    lower.includes("503") ||
    lower.includes("block not found")
  );
}

/** Bind each x402 settlement to exactly one on-chain split (replay protection). */
export function settlementIdFromRef(ref: string | null | undefined): Hex {
  if (!ref) {
    throw new SettlementIncompleteError("Missing x402 settlement reference");
  }
  if (ref.startsWith("0x") && ref.length === 66) return ref as Hex;
  return keccak256(toBytes(ref));
}

async function recoverSplitTxIfClaimed(
  settlementId: Hex,
  contentId?: number,
  creatorWallet?: Address,
): Promise<string | null> {
  const contract = getSplitContractAddress();
  if (!contract) return null;

  const publicClient = getPublicClient();
  const claimed = await publicClient.readContract({
    address: contract,
    abi: leptonSplitAbi,
    functionName: "settlementClaimed",
    args: [settlementId],
  });
  if (!claimed) return null;

  if (contentId != null) {
    const logs = await publicClient.getContractEvents({
      address: contract,
      abi: leptonSplitAbi,
      eventName: "SplitPayment",
      args: { settlementId, contentId: BigInt(contentId) },
      fromBlock: 0n,
      toBlock: "latest",
    });
    const hash = logs.at(-1)?.transactionHash;
    if (hash) {
      logger.info({ settlementId, contentId, splitTxHash: hash }, "Recovered prior SplitPayment from chain");
      return hash;
    }
  }

  if (creatorWallet) {
    const logs = await publicClient.getContractEvents({
      address: contract,
      abi: leptonSplitAbi,
      eventName: "SplitTip",
      args: { settlementId, creator: creatorWallet },
      fromBlock: 0n,
      toBlock: "latest",
    });
    const hash = logs.at(-1)?.transactionHash;
    if (hash) {
      logger.info({ settlementId, creatorWallet, splitTxHash: hash }, "Recovered prior SplitTip from chain");
      return hash;
    }
  }

  return null;
}

export function creatorBpsForVerified(verified: boolean): number {
  return verified ? 10_000 : 9_500;
}

/** Real creators must have a provisioned in-app wallet — no platform-wallet fallback. */
export async function resolveCreatorWalletStrict(creatorId: string): Promise<Address> {
  if (isSystemCreator(creatorId)) {
    const platform = getPlatformWalletAddress();
    if (!platform) {
      throw new CreatorWalletRequiredError(
        "PLATFORM_WALLET_ADDRESS is required for platform-owned content",
      );
    }
    return platform;
  }

  const rows = await db
    .select({ clerkId: usersTable.clerkId })
    .from(usersTable)
    .where(eq(usersTable.clerkId, creatorId))
    .limit(1);

  if (!rows.length) {
    throw new CreatorWalletRequiredError(
      "Sign in and complete onboarding before publishing paid content",
    );
  }

  const user = await provisionUserWallet(creatorId);
  const payoutAddress = deriveWalletAddress(user);
  if (!payoutAddress) {
    throw new CreatorWalletRequiredError(
      "Your LeptonPad creator wallet could not be provisioned. Try again from Settings.",
    );
  }

  return payoutAddress;
}

export async function resolveCreatorWallet(
  creatorId: string,
): Promise<Address | null> {
  try {
    return await resolveCreatorWalletStrict(creatorId);
  } catch {
    return null;
  }
}

export async function getOnChainContentRegistration(contentId: number): Promise<{
  registered: boolean;
  creator: Address | null;
  bps: number;
}> {
  if (!requiresAtomicSplit()) {
    return { registered: false, creator: null, bps: 0 };
  }

  const contract = getSplitContractAddress()!;
  const publicClient = getPublicClient();
  const creator = await publicClient.readContract({
    address: contract,
    abi: leptonSplitAbi,
    functionName: "contentCreator",
    args: [BigInt(contentId)],
  });

  if (creator === zeroAddress) {
    return { registered: false, creator: null, bps: 0 };
  }

  const bps = await publicClient.readContract({
    address: contract,
    abi: leptonSplitAbi,
    functionName: "contentBps",
    args: [BigInt(contentId)],
  });

  return {
    registered: true,
    creator: creator as Address,
    bps: Number(bps) || 9_500,
  };
}

/** Register creator payout route on LeptonSplit — runs at first settlement, not at publish. */
export async function registerContentOnChain(input: {
  contentId: number;
  creatorId: string;
  verified: boolean;
}): Promise<void> {
  if (isMockPayments()) return;

  const contract = getSplitContractAddress();
  if (!contract) {
    throw new SettlementIncompleteError("LEPTON_SPLIT_CONTRACT is not configured");
  }

  const creatorWallet = await resolveCreatorWalletStrict(input.creatorId);
  const bps = creatorBpsForVerified(input.verified);
  const publicClient = getPublicClient();

  const onChainCreator = await publicClient.readContract({
    address: contract,
    abi: leptonSplitAbi,
    functionName: "contentCreator",
    args: [BigInt(input.contentId)],
  });

  if (onChainCreator !== zeroAddress) {
    if (onChainCreator.toLowerCase() !== creatorWallet.toLowerCase()) {
      throw new CreatorWalletRequiredError(
        `Content #${input.contentId} is locked on-chain to ${onChainCreator}, but this creator's wallet is ${creatorWallet}. Publish as new content to use the correct wallet.`,
      );
    }
    return;
  }

  const client = getOwnerWalletClient();
  const hash = await client.writeContract({
    address: contract,
    abi: leptonSplitAbi,
    functionName: "registerContentCreator",
    args: [BigInt(input.contentId), creatorWallet, bps],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  logger.info(
    { contentId: input.contentId, creatorWallet, bps },
    "Content registered on LeptonSplit",
  );
}

export async function assertContentRegisteredOnChain(contentId: number): Promise<void> {
  if (!requiresAtomicSplit()) return;

  const contract = getSplitContractAddress()!;
  const onChainCreator = await getPublicClient().readContract({
    address: contract,
    abi: leptonSplitAbi,
    functionName: "contentCreator",
    args: [BigInt(contentId)],
  });

  if (onChainCreator === zeroAddress) {
    throw new SettlementIncompleteError(
      "Paid content is not registered on LeptonSplit. Republish or contact support.",
    );
  }
}

/** Register at settlement time if missing; access to read stays in the app DB. */
export async function ensureContentRegisteredOnChain(input: {
  contentId: number;
  creatorId: string;
  verified: boolean;
}): Promise<void> {
  if (!requiresAtomicSplit()) return;
  await registerContentOnChain(input);
  await assertContentRegisteredOnChain(input.contentId);
}

/**
 * Register paid content that missed on-chain registration at publish.
 * Uses each article's publish-time verification snapshot — never retroactive upgrades.
 */
export async function registerPendingCreatorContentOnChain(
  creatorId: string,
): Promise<CreatorVerifyOnChainSync> {
  const empty: CreatorVerifyOnChainSync = {
    newlyRegistered: [],
    failed: [],
  };

  if (isMockPayments() || isSystemCreator(creatorId) || !requiresAtomicSplit()) {
    return empty;
  }

  const rows = await db
    .select({
      id: contentTable.id,
      creatorVerifiedAtPublish: contentTable.creatorVerifiedAtPublish,
    })
    .from(contentTable)
    .where(
      and(
        eq(contentTable.creatorId, creatorId),
        eq(contentTable.published, true),
        sql`cast(${contentTable.price} as numeric) > 0`,
      ),
    );

  const result: CreatorVerifyOnChainSync = {
    newlyRegistered: [],
    failed: [],
  };

  for (const row of rows) {
    try {
      const onChain = await getOnChainContentRegistration(row.id);
      if (onChain.registered) continue;

      const verifiedAtPublish = row.creatorVerifiedAtPublish ?? false;
      await registerContentOnChain({
        contentId: row.id,
        creatorId,
        verified: verifiedAtPublish,
      });
      result.newlyRegistered.push(row.id);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      result.failed.push({ contentId: row.id, reason });
      logger.error({ contentId: row.id, creatorId, reason }, "Pending on-chain registration failed");
    }
  }

  return result;
}

/** @deprecated Use registerPendingCreatorContentOnChain — verification changes do not alter published bps. */
export const syncCreatorVerifiedOnChain = registerPendingCreatorContentOnChain;

/** Register tip bps per creator wallet — locked after first registration. */
export async function registerTipCreatorOnChain(
  creatorId: string,
  verified: boolean,
): Promise<Address | null> {
  if (isMockPayments()) return null;

  const contract = getSplitContractAddress();
  if (!contract) return null;

  let creatorWallet: Address;
  try {
    creatorWallet = await resolveCreatorWalletStrict(creatorId);
  } catch {
    return null;
  }

  const bps = creatorBpsForVerified(verified);
  const publicClient = getPublicClient();

  const onChainBps = await publicClient.readContract({
    address: contract,
    abi: leptonSplitAbi,
    functionName: "tipCreatorBps",
    args: [creatorWallet],
  });

  if (Number(onChainBps) > 0) return creatorWallet;

  const client = getOwnerWalletClient();
  const hash = await client.writeContract({
    address: contract,
    abi: leptonSplitAbi,
    functionName: "registerTipCreator",
    args: [creatorWallet, bps],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return creatorWallet;
}

export interface AtomicSplitResult {
  ok: boolean;
  splitTxHash: string | null;
  reason?: string;
  recovered?: boolean;
}

async function runSplitWithRetries(input: {
  contentId?: number;
  creatorWallet?: Address;
  amountUsdc: number;
  settlementRef: string | null | undefined;
  maxAttempts?: number;
  splitFn: (
    settlementId: Hex,
    amount: bigint,
    client: ReturnType<typeof getOwnerWalletClient>,
  ) => Promise<Hex>;
}): Promise<AtomicSplitResult> {
  if (isMockPayments()) return { ok: true, splitTxHash: null };

  const contract = getSplitContractAddress();
  if (!contract) return { ok: false, splitTxHash: null, reason: "no-split-contract" };
  if (!getOwnerPrivateKey()) {
    return { ok: false, splitTxHash: null, reason: "no-split-owner-key" };
  }

  let settlementId: Hex;
  try {
    settlementId = settlementIdFromRef(input.settlementRef);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, splitTxHash: null, reason: message };
  }

  const recovered = await recoverSplitTxIfClaimed(
    settlementId,
    input.contentId,
    input.creatorWallet,
  );
  if (recovered) {
    return { ok: true, splitTxHash: recovered, recovered: true };
  }

  const amount = parseUnits(input.amountUsdc.toFixed(6), 6);
  const publicClient = getPublicClient();
  const client = getOwnerWalletClient();
  const maxAttempts = input.maxAttempts ?? SPLIT_RETRY_ATTEMPTS;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const balance = await publicClient.readContract({
        address: contract,
        abi: leptonSplitAbi,
        functionName: "contractBalance",
      });

      if (balance < amount) {
        throw new Error(`contract balance ${balance} < ${amount} (waiting for Gateway batch credit)`);
      }

      const hash = await input.splitFn(settlementId, amount, client);
      await publicClient.waitForTransactionReceipt({ hash });

      logger.info(
        {
          contentId: input.contentId,
          creatorWallet: input.creatorWallet,
          amountUsdc: input.amountUsdc,
          settlementId,
          splitTxHash: hash,
        },
        "Atomic split executed on LeptonSplit",
      );
      return { ok: true, splitTxHash: hash };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      if (message.toLowerCase().includes("settlement used")) {
        const recoveredTx = await recoverSplitTxIfClaimed(
          settlementId,
          input.contentId,
          input.creatorWallet,
        );
        if (recoveredTx) {
          return { ok: true, splitTxHash: recoveredTx, recovered: true };
        }
      }

      if (!isRetryableSplitError(message) || attempt >= maxAttempts - 1) {
        logger.error(
          { contentId: input.contentId, amountUsdc: input.amountUsdc, message, attempt },
          "Atomic split failed",
        );
        return { ok: false, splitTxHash: null, reason: message };
      }

      const delay = retryDelayMs(attempt);
      logger.warn({ contentId: input.contentId, attempt, delay, message }, "Split retry");
      await wait(delay);
    }
  }

  return { ok: false, splitTxHash: null, reason: "exhausted retries" };
}

/**
 * Atomically split USDC held by LeptonSplit after x402 Gateway credits the contract.
 * Retries while Gateway batch settlement is landing on-chain.
 */
export async function executeAtomicContentSplit(
  contentId: number,
  amountUsdc: number,
  settlementRef: string | null | undefined,
  options?: { maxAttempts?: number },
): Promise<AtomicSplitResult> {
  const contract = getSplitContractAddress();
  if (!contract) return { ok: false, splitTxHash: null, reason: "no-split-contract" };

  return runSplitWithRetries({
    contentId,
    amountUsdc,
    settlementRef,
    maxAttempts: options?.maxAttempts,
    splitFn: (settlementId, amount, client) =>
      client.writeContract({
        address: contract,
        abi: leptonSplitAbi,
        functionName: "splitPayment",
        args: [settlementId, BigInt(contentId), amount],
      }),
  });
}

export async function executeAtomicTipSplit(
  creatorWallet: Address,
  amountUsdc: number,
  settlementRef: string | null | undefined,
): Promise<AtomicSplitResult> {
  const contract = getSplitContractAddress();
  if (!contract) return { ok: false, splitTxHash: null, reason: "no-split-contract" };

  return runSplitWithRetries({
    creatorWallet,
    amountUsdc,
    settlementRef,
    splitFn: (settlementId, amount, client) =>
      client.writeContract({
        address: contract,
        abi: leptonSplitAbi,
        functionName: "splitToCreator",
        args: [settlementId, creatorWallet, amount],
      }),
  });
}

/** @deprecated Use registerContentOnChain at publish time. */
export const registerSaleOnChain = registerContentOnChain;
