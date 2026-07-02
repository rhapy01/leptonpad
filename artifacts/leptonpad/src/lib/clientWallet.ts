import { BatchEvmScheme, GatewayClient } from "@circle-fin/x402-batching/client";
import { createWalletClient, http, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { apiFetch } from "./apiFetch";
import {
  importLegacyClientWallet,
  loadClientWallet,
  saveClientWallet,
} from "./clientWalletStorage";

const ARC_CHAIN = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
} as const;

function registrationMessage(clerkId: string, timestamp: number): string {
  return `LeptonPad wallet registration\nclerkId:${clerkId}\ntimestamp:${timestamp}`;
}

export function createSchemeFromPrivateKey(privateKey: Hex): BatchEvmScheme {
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account,
    chain: ARC_CHAIN,
    transport: http(),
  });
  const signer = {
    address: account.address,
    signTypedData: (params: Parameters<typeof walletClient.signTypedData>[0]) =>
      walletClient.signTypedData(params),
  };
  return new BatchEvmScheme(signer);
}

export function createGatewayClient(privateKey: Hex, chainName = "arcTestnet"): GatewayClient {
  return new GatewayClient({ chain: chainName as "arcTestnet", privateKey });
}

async function registerAddressOnServer(address: Hex, privateKey: Hex, clerkId: string): Promise<void> {
  const timestamp = Date.now();
  const message = registrationMessage(clerkId, timestamp);
  const account = privateKeyToAccount(privateKey);
  const signature = await account.signMessage({ message });

  const res = await apiFetch("/api/wallet/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, signature, timestamp }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Failed to register wallet address");
  }
}

export async function ensureClientWallet(clerkId: string): Promise<{ privateKey: Hex; address: Hex }> {
  const existing = await loadClientWallet(clerkId);
  if (existing) return existing;

  const privateKey = generatePrivateKey();
  const address = privateKeyToAccount(privateKey).address;
  await saveClientWallet(clerkId, privateKey, address);
  await registerAddressOnServer(address, privateKey, clerkId);
  return { privateKey, address };
}

export async function migrateLegacyServerWallet(clerkId: string): Promise<boolean> {
  const res = await apiFetch("/api/wallet/export-legacy-key", { method: "POST" });
  if (res.status === 404) return false;
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Legacy wallet migration failed");
  }
  const data = await res.json() as { privateKey: Hex; address: Hex };
  await importLegacyClientWallet(clerkId, data.privateKey, data.address);
  return true;
}

export async function getClientPaymentScheme(clerkId: string): Promise<BatchEvmScheme> {
  const { privateKey } = await ensureClientWallet(clerkId);
  return createSchemeFromPrivateKey(privateKey);
}

export async function getClientGatewayClient(clerkId: string, chainName?: string): Promise<GatewayClient> {
  const { privateKey } = await ensureClientWallet(clerkId);
  return createGatewayClient(privateKey, chainName);
}

export async function markGatewayReadyOnServer(): Promise<void> {
  await apiFetch("/api/wallet/gateway-ready", { method: "POST" });
}
