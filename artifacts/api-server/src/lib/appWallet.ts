import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { BatchEvmScheme, GatewayClient } from "@circle-fin/x402-batching/client";
import { eq } from "drizzle-orm";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  erc20Abi,
  type Address,
  type Hex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { db, usersTable } from "@workspace/db";
import { arcTestnet } from "./arcChain";
import { getPaymentConfig, isMockPayments } from "./gateway";
import { isClientWalletMode, userUsesCustodialWallet } from "./walletMode";

const ENCRYPTION_VERSION = "v1";
const GATEWAY_MIN_BALANCE = 1;
const GATEWAY_DEPOSIT_USDC = "5";
const TREASURY_FUND_USDC = "5";
const MAX_TREASURY_TOPUP_USDC = 25;
const BALANCE_POLL_MS = 2500;
const BALANCE_POLL_ATTEMPTS = 8;
/** Circle Gateway ERC-20 USDC on Arc testnet (not native balance). */
const ARC_USDC_ADDRESS = "0x3600000000000000000000000000000000000000" as Address;

const arcPublicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(),
});

async function getOnChainUsdcBalance(address: Address): Promise<number> {
  const balance = await arcPublicClient.readContract({
    address: ARC_USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address],
  });
  return Number.parseFloat((Number(balance) / 1_000_000).toFixed(6));
}

function encryptionKey(): Buffer {
  const secret = process.env.WALLET_ENCRYPTION_SECRET;
  if (!secret) {
    if (isMockPayments()) {
      if (process.env.NODE_ENV === "production") {
        throw new Error("MOCK_PAYMENTS cannot be enabled in production");
      }
      return createHash("sha256").update("leptonpad-dev-wallet-secret").digest();
    }
    throw new Error("WALLET_ENCRYPTION_SECRET is required when MOCK_PAYMENTS=false");
  }
  if (secret.length < 24) {
    throw new Error("WALLET_ENCRYPTION_SECRET must be at least 24 characters");
  }
  return createHash("sha256").update(secret).digest();
}

export function encryptPrivateKey(privateKey: Hex): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(privateKey, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENCRYPTION_VERSION}:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

/** Authoritative payout address — always derived from the encrypted key, never user-editable. */
export function deriveWalletAddress(user: {
  walletEncryptedKey: string | null;
  walletAddress?: string | null;
}): Address | null {
  if (!user.walletEncryptedKey) return null;
  try {
    const privateKey = decryptPrivateKey(user.walletEncryptedKey);
    return privateKeyToAccount(privateKey).address;
  } catch {
    return null;
  }
}

/** Fix DB if walletAddress was tampered with — payouts always use the derived key address. */
export async function reconcileWalletAddress(
  user: typeof usersTable.$inferSelect,
): Promise<typeof usersTable.$inferSelect> {
  if (!user.walletEncryptedKey) return user;
  const derived = deriveWalletAddress(user);
  if (user.walletAddress?.toLowerCase() === derived.toLowerCase()) return user;

  const [fixed] = await db
    .update(usersTable)
    .set({ walletAddress: derived })
    .where(eq(usersTable.clerkId, user.clerkId))
    .returning();

  return fixed ?? user;
}

export function decryptPrivateKey(payload: string): Hex {
  const [version, ivB64, tagB64, dataB64] = payload.split(":");
  if (version !== ENCRYPTION_VERSION || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid wallet key payload");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8") as Hex;
}

export function createSchemeFromPrivateKey(privateKey: Hex): BatchEvmScheme {
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(),
  });
  const signer = {
    address: account.address,
    signTypedData: (params: Parameters<typeof walletClient.signTypedData>[0]) =>
      walletClient.signTypedData(params),
  };
  return new BatchEvmScheme(signer);
}

export async function provisionUserWallet(clerkId: string): Promise<typeof usersTable.$inferSelect> {
  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkId))
    .limit(1);

  if (!existing.length) {
    throw new Error("User not found");
  }

  const user = existing[0];

  if (isClientWalletMode()) {
    if (user.walletAddress) return reconcileWalletAddress(user);
    return user;
  }

  if (user.walletAddress && user.walletEncryptedKey) {
    return reconcileWalletAddress(user);
  }

  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  const [updated] = await db
    .update(usersTable)
    .set({
      walletAddress: account.address,
      walletEncryptedKey: encryptPrivateKey(privateKey),
      walletGatewayReady: false,
    })
    .where(eq(usersTable.clerkId, clerkId))
    .returning();

  return updated;
}

async function fundFromTreasury(toAddress: Address, amountUsdc: string): Promise<Hex> {
  const raw =
    process.env.TREASURY_PRIVATE_KEY ?? process.env.PRIVATE_KEYS;
  const treasuryKey = raw
    ? ((raw.startsWith("0x") ? raw : `0x${raw}`) as Hex)
    : undefined;
  if (!treasuryKey) {
    throw new Error("Testnet treasury is not configured");
  }

  const account = privateKeyToAccount(treasuryKey);
  const client = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(),
  });

  const amount = parseUnits(amountUsdc, 6);
  const hash = await client.writeContract({
    address: ARC_USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "transfer",
    args: [toAddress, amount],
  });
  await arcPublicClient.waitForTransactionReceipt({ hash });

  return hash;
}

async function refreshGatewayBalances(
  client: GatewayClient,
): Promise<{ gatewayAvail: number; walletBal: number; balances: Awaited<ReturnType<GatewayClient["getBalances"]>> }> {
  const balances = await client.getBalances();
  const gatewayAvail = Number.parseFloat(balances.gateway.formattedAvailable);
  const walletBal = Number.parseFloat(balances.wallet.formatted);
  return { gatewayAvail, walletBal, balances };
}

async function pollGatewayReady(
  client: GatewayClient,
  address: Address,
): Promise<{ gatewayAvail: number; walletBal: number; balances: Awaited<ReturnType<GatewayClient["getBalances"]>> }> {
  let latest = await refreshGatewayBalances(client);
  for (let i = 0; i < BALANCE_POLL_ATTEMPTS; i++) {
    if (latest.gatewayAvail >= GATEWAY_MIN_BALANCE) return latest;
    const onChain = await getOnChainUsdcBalance(address);
    if (latest.walletBal < onChain) {
      latest = await refreshGatewayBalances(client);
      if (latest.gatewayAvail >= GATEWAY_MIN_BALANCE) return latest;
    }
    await wait(BALANCE_POLL_MS);
    latest = await refreshGatewayBalances(client);
  }
  return latest;
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function activateGatewayWallet(clerkId: string): Promise<{
  ready: boolean;
  gatewayAvailable: string;
  walletBalance: string;
  funded: boolean;
}> {
  if (isMockPayments()) {
    await db
      .update(usersTable)
      .set({ walletGatewayReady: true })
      .where(eq(usersTable.clerkId, clerkId));
    return { ready: true, gatewayAvailable: "0", walletBalance: "0", funded: false };
  }

  const user = await provisionUserWallet(clerkId);
  if (!user.walletEncryptedKey) {
    throw new Error("Wallet not provisioned");
  }

  const privateKey = decryptPrivateKey(user.walletEncryptedKey);
  const chainName = getPaymentConfig().chainName as "arcTestnet";
  const client = new GatewayClient({ chain: chainName, privateKey });
  const walletAddress = user.walletAddress as Address;

  let { gatewayAvail, walletBal, balances } = await refreshGatewayBalances(client);
  let funded = false;
  const onChainBal = await getOnChainUsdcBalance(walletAddress);
  const spendableWalletBal = Math.max(walletBal, onChainBal);

  if (gatewayAvail < GATEWAY_MIN_BALANCE) {
    if (spendableWalletBal < Number.parseFloat(GATEWAY_DEPOSIT_USDC)) {
      try {
        await fundFromTreasury(walletAddress, TREASURY_FUND_USDC);
        funded = true;
        await wait(6000);
        ({ gatewayAvail, walletBal, balances } = await pollGatewayReady(client, walletAddress));
      } catch {
        funded = false;
      }
    }

    const walletAfterFund = Math.max(
      walletBal,
      await getOnChainUsdcBalance(walletAddress),
    );

    if (gatewayAvail < GATEWAY_MIN_BALANCE && walletAfterFund >= Number.parseFloat(GATEWAY_DEPOSIT_USDC)) {
      try {
        await client.deposit(GATEWAY_DEPOSIT_USDC);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Gateway deposit failed";
        throw new Error(message);
      }
      ({ gatewayAvail, walletBal, balances } = await pollGatewayReady(client, walletAddress));
    }
  }

  const ready = gatewayAvail >= GATEWAY_MIN_BALANCE;
  if (ready) {
    await db
      .update(usersTable)
      .set({ walletGatewayReady: true })
      .where(eq(usersTable.clerkId, clerkId));
  }

  return {
    ready,
    gatewayAvailable: balances.gateway.formattedAvailable,
    walletBalance: balances.wallet.formatted,
    funded,
  };
}

export async function getAppWalletStatus(clerkId: string) {
  const user = await reconcileWalletAddress(await provisionUserWallet(clerkId));
  const address = deriveWalletAddress(user) ?? user.walletAddress;
  const config = getPaymentConfig();
  const custodial = userUsesCustodialWallet(user);

  if (config.mockMode) {
    return {
      address,
      clientSide: isClientWalletMode() && !custodial,
      gatewayReady: true,
      gatewayAvailable: null as string | null,
      walletBalance: null as string | null,
      mockMode: true,
    };
  }

  if (isClientWalletMode() && !custodial) {
    return {
      address: user.walletAddress,
      clientSide: true,
      gatewayReady: user.walletGatewayReady,
      gatewayAvailable: null,
      walletBalance: null,
      onChainBalance: null,
      mockMode: false,
    };
  }

  if (!user.walletEncryptedKey) {
    return {
      address,
      gatewayReady: false,
      gatewayAvailable: null,
      walletBalance: null,
      mockMode: false,
    };
  }

  try {
    const privateKey = decryptPrivateKey(user.walletEncryptedKey);
    const client = new GatewayClient({
      chain: config.chainName as "arcTestnet",
      privateKey,
    });
    const balances = await client.getBalances();
    const gatewayAvail = Number.parseFloat(balances.gateway.formattedAvailable);
    const ready = user.walletGatewayReady || gatewayAvail >= GATEWAY_MIN_BALANCE;
    const onChainBalance = address
      ? (await getOnChainUsdcBalance(address as Address)).toFixed(6)
      : null;

    return {
      address,
      gatewayReady: ready,
      gatewayAvailable: balances.gateway.formattedAvailable,
      walletBalance: onChainBalance ?? balances.wallet.formatted,
      onChainBalance,
      mockMode: false,
    };
  } catch {
    return {
      address,
      gatewayReady: user.walletGatewayReady,
      gatewayAvailable: null,
      walletBalance: null,
      mockMode: false,
    };
  }
}

export async function exportLegacyWalletKey(clerkId: string): Promise<{ privateKey: Hex; address: Address } | null> {
  if (!isClientWalletMode()) return null;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkId))
    .limit(1);

  if (!user?.walletEncryptedKey) return null;

  const privateKey = decryptPrivateKey(user.walletEncryptedKey);
  const address = (deriveWalletAddress(user) ?? user.walletAddress) as Address;

  await db
    .update(usersTable)
    .set({ walletEncryptedKey: null })
    .where(eq(usersTable.clerkId, clerkId));

  return { privateKey, address };
}

export async function registerClientWalletAddress(
  clerkId: string,
  address: Address,
): Promise<typeof usersTable.$inferSelect> {
  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.walletAddress, address))
    .limit(1);

  if (existing.length > 0 && existing[0].clerkId !== clerkId) {
    throw new Error("Wallet address already linked to another account");
  }

  const [updated] = await db
    .update(usersTable)
    .set({
      walletAddress: address,
      walletEncryptedKey: null,
      walletGatewayReady: false,
    })
    .where(eq(usersTable.clerkId, clerkId))
    .returning();

  if (!updated) throw new Error("User not found");
  return updated;
}

export async function markClientGatewayReady(clerkId: string): Promise<void> {
  await db
    .update(usersTable)
    .set({ walletGatewayReady: true })
    .where(eq(usersTable.clerkId, clerkId));
}

export async function getUserPaymentScheme(clerkId: string): Promise<BatchEvmScheme> {
  const user = await provisionUserWallet(clerkId);
  if (isClientWalletMode() && !userUsesCustodialWallet(user)) {
    throw new Error("Client-side wallet required — private keys are not stored on the server");
  }
  if (!user.walletEncryptedKey) {
    throw new Error("In-app wallet not ready");
  }
  const privateKey = decryptPrivateKey(user.walletEncryptedKey);
  return createSchemeFromPrivateKey(privateKey);
}

function gatewayClientForUser(
  clerkId: string,
  user: typeof usersTable.$inferSelect,
): GatewayClient {
  if (!user.walletEncryptedKey) {
    throw new Error("In-app wallet not provisioned");
  }
  const privateKey = decryptPrivateKey(user.walletEncryptedKey);
  const chainName = getPaymentConfig().chainName as "arcTestnet";
  return new GatewayClient({ chain: chainName, privateKey });
}

/** Move USDC from Circle Gateway back to your on-chain Arc wallet (crypto withdraw, not bank). */
export async function withdrawFromGateway(clerkId: string, amount: string) {
  if (isMockPayments()) {
    throw new Error("Withdrawals are not available in demo mode");
  }

  const parsed = Number.parseFloat(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Enter a valid withdrawal amount");
  }

  const user = await provisionUserWallet(clerkId);
  const client = gatewayClientForUser(clerkId, user);
  const before = await refreshGatewayBalances(client);
  const available = Number.parseFloat(before.balances.gateway.formattedAvailable);
  if (parsed > available + 1e-9) {
    throw new Error(`Only ${before.balances.gateway.formattedAvailable} USDC available in Gateway`);
  }

  const result = await client.withdraw(amount);
  const after = await refreshGatewayBalances(client);

  return {
    amount: result.formattedAmount,
    txHash: result.mintTxHash,
    gatewayAvailable: after.balances.gateway.formattedAvailable,
    walletBalance: after.balances.wallet.formatted,
  };
}

/** Move on-chain USDC into Circle Gateway so you can unlock content or tip. */
export async function depositToGateway(clerkId: string, amount: string) {
  if (isMockPayments()) {
    throw new Error("Deposits are not available in demo mode");
  }

  const parsed = Number.parseFloat(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Enter a valid deposit amount");
  }

  const user = await provisionUserWallet(clerkId);
  const walletAddress = user.walletAddress as Address;
  const client = gatewayClientForUser(clerkId, user);
  const onChain = await getOnChainUsdcBalance(walletAddress);
  if (parsed > onChain + 1e-9) {
    throw new Error(`Only ${onChain.toFixed(6)} USDC available on-chain`);
  }

  const deposit = await client.deposit(amount);
  const after = await pollGatewayReady(client, walletAddress);

  return {
    amount,
    depositTxHash: deposit.depositTxHash,
    gatewayAvailable: after.balances.gateway.formattedAvailable,
    walletBalance: (await getOnChainUsdcBalance(walletAddress)).toFixed(6),
  };
}

/** Request testnet USDC from the platform treasury to your on-chain wallet. */
export async function fundWalletFromTreasury(clerkId: string, amount: string) {
  if (isMockPayments()) {
    throw new Error("Testnet top-ups are not available in demo mode");
  }

  const parsed = Number.parseFloat(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Enter a valid amount");
  }
  if (parsed > MAX_TREASURY_TOPUP_USDC) {
    throw new Error(`Maximum ${MAX_TREASURY_TOPUP_USDC} USDC per testnet top-up`);
  }

  const user = await provisionUserWallet(clerkId);
  if (!user.walletAddress) {
    throw new Error("Wallet address not registered — open Wallet in the app first");
  }
  const walletAddress = user.walletAddress as Address;
  const txHash = await fundFromTreasury(walletAddress, amount);
  const onChain = (await getOnChainUsdcBalance(walletAddress)).toFixed(6);

  let gatewayAvailable: string | null = null;
  if (user.walletEncryptedKey) {
    try {
      const client = gatewayClientForUser(clerkId, user);
      const balances = await client.getBalances();
      gatewayAvailable = balances.gateway.formattedAvailable;
    } catch {
      gatewayAvailable = null;
    }
  }

  return { amount, txHash, walletBalance: onChain, gatewayAvailable };
}
