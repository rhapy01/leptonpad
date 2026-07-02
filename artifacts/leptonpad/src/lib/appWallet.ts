import { apiFetch } from "./apiFetch";
import { payGatewayResource } from "./gatewayPayClient";
import {
  ensureClientWallet,
  getClientGatewayClient,
  getClientPaymentScheme,
  markGatewayReadyOnServer,
  migrateLegacyServerWallet,
} from "./clientWallet";

export interface AppWalletStatus {
  address: string | null;
  gatewayReady: boolean;
  gatewayAvailable: string | null;
  walletBalance: string | null;
  onChainBalance?: string | null;
  mockMode: boolean;
  clientSide?: boolean;
  locked?: boolean;
  addressMasked?: string | null;
}

export interface PaymentConfig {
  enabled: boolean;
  mockMode: boolean;
  chainId: number;
  network: string;
  chainName: string;
  facilitatorUrl: string;
  sellerAddress: string | null;
  minPrice: number;
  creatorShare: number;
  inAppWallet?: boolean;
  clientSideWallet?: boolean;
}

type UserIdGetter = () => string | null;

let getClerkUserId: UserIdGetter | null = null;

export function setClerkUserIdGetter(getter: UserIdGetter | null): void {
  getClerkUserId = getter;
}

function requireClerkUserId(): string {
  const id = getClerkUserId?.();
  if (!id) throw new Error("Sign in to use your LeptonPad wallet");
  return id;
}

const GATEWAY_MIN_BALANCE = 1;
const GATEWAY_DEPOSIT_USDC = "5";

export async function fetchPaymentConfig(): Promise<PaymentConfig> {
  const res = await apiFetch("/api/payments/config");
  if (!res.ok) throw new Error("Failed to load payment config");
  return res.json() as Promise<PaymentConfig>;
}

export async function fetchAppWallet(): Promise<AppWalletStatus> {
  const res = await apiFetch("/api/wallet");
  if (res.status === 401) throw new Error("Session not recognized — refresh the page and sign in again");
  if (!res.ok) throw new Error("Failed to load wallet");
  return res.json() as Promise<AppWalletStatus>;
}

async function enrichClientWalletStatus(
  status: AppWalletStatus,
  chainName: string,
): Promise<AppWalletStatus> {
  if (!status.clientSide) return status;

  const clerkId = getClerkUserId?.();
  if (!clerkId) return status;

  try {
    await migrateLegacyServerWallet(clerkId);
    const { address } = await ensureClientWallet(clerkId);
    const client = await getClientGatewayClient(clerkId, chainName);
    const balances = await client.getBalances();
    const gatewayAvail = Number.parseFloat(balances.gateway.formattedAvailable);

    return {
      ...status,
      address: address ?? status.address,
      gatewayAvailable: balances.gateway.formattedAvailable,
      walletBalance: balances.wallet.formatted,
      onChainBalance: balances.wallet.formatted,
      gatewayReady: status.gatewayReady || gatewayAvail >= GATEWAY_MIN_BALANCE,
      clientSide: true,
    };
  } catch {
    return { ...status, clientSide: true };
  }
}

export async function fetchAppWalletFull(chainName = "arcTestnet"): Promise<AppWalletStatus> {
  const status = await fetchAppWallet();
  return enrichClientWalletStatus(status, chainName);
}

export async function activateAppWallet(): Promise<{
  ready: boolean;
  gatewayAvailable: string;
  walletBalance: string;
  funded: boolean;
}> {
  const config = await fetchPaymentConfig();
  const clerkId = requireClerkUserId();

  if (config.clientSideWallet && !config.mockMode) {
    await migrateLegacyServerWallet(clerkId);
    const { address } = await ensureClientWallet(clerkId);
    const client = await getClientGatewayClient(clerkId, config.chainName);

    let balances = await client.getBalances();
    let gatewayAvail = Number.parseFloat(balances.gateway.formattedAvailable);
    let funded = false;

    if (gatewayAvail < GATEWAY_MIN_BALANCE) {
      try {
        await fundWalletUsdc("5");
        funded = true;
        await new Promise((r) => setTimeout(r, 6000));
        balances = await client.getBalances();
        gatewayAvail = Number.parseFloat(balances.gateway.formattedAvailable);
      } catch {
        funded = false;
      }

      const walletBal = Number.parseFloat(balances.wallet.formatted);
      if (gatewayAvail < GATEWAY_MIN_BALANCE && walletBal >= Number.parseFloat(GATEWAY_DEPOSIT_USDC)) {
        await client.deposit(GATEWAY_DEPOSIT_USDC);
        balances = await client.getBalances();
        gatewayAvail = Number.parseFloat(balances.gateway.formattedAvailable);
      }
    }

    const ready = gatewayAvail >= GATEWAY_MIN_BALANCE;
    if (ready) await markGatewayReadyOnServer();

    return {
      ready,
      gatewayAvailable: balances.gateway.formattedAvailable,
      walletBalance: balances.wallet.formatted,
      funded,
    };
  }

  const res = await apiFetch("/api/wallet/activate", { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Wallet activation failed");
  }
  return res.json();
}

export async function withdrawGatewayUsdc(amount: string): Promise<{
  amount: string;
  txHash: string;
  gatewayAvailable: string;
  walletBalance: string;
}> {
  const config = await fetchPaymentConfig();
  const clerkId = requireClerkUserId();

  if (config.clientSideWallet && !config.mockMode) {
    const client = await getClientGatewayClient(clerkId, config.chainName);
    const before = await client.getBalances();
    const available = Number.parseFloat(before.gateway.formattedAvailable);
    const parsed = Number.parseFloat(amount);
    if (parsed > available + 1e-9) {
      throw new Error(`Only ${before.gateway.formattedAvailable} USDC available in Gateway`);
    }
    const result = await client.withdraw(amount);
    const after = await client.getBalances();
    return {
      amount: result.formattedAmount,
      txHash: result.mintTxHash,
      gatewayAvailable: after.gateway.formattedAvailable,
      walletBalance: after.wallet.formatted,
    };
  }

  const res = await apiFetch("/api/wallet/withdraw", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Withdrawal failed");
  }
  return res.json();
}

export async function depositGatewayUsdc(amount: string): Promise<{
  amount: string;
  depositTxHash: string;
  gatewayAvailable: string;
  walletBalance: string;
}> {
  const config = await fetchPaymentConfig();
  const clerkId = requireClerkUserId();

  if (config.clientSideWallet && !config.mockMode) {
    const client = await getClientGatewayClient(clerkId, config.chainName);
    const deposit = await client.deposit(amount);
    const after = await client.getBalances();
    return {
      amount,
      depositTxHash: deposit.depositTxHash,
      gatewayAvailable: after.gateway.formattedAvailable,
      walletBalance: after.wallet.formatted,
    };
  }

  const res = await apiFetch("/api/wallet/deposit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Deposit failed");
  }
  return res.json();
}

export async function fundWalletUsdc(amount: string): Promise<{
  amount: string;
  txHash: string;
  walletBalance: string;
  gatewayAvailable: string | null;
}> {
  const config = await fetchPaymentConfig();
  if (config.clientSideWallet && !config.mockMode) {
    await ensureClientWallet(requireClerkUserId());
  }

  const res = await apiFetch("/api/wallet/fund", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Top-up failed");
  }
  return res.json();
}

export async function unlockContentInApp(contentId: number): Promise<{
  success: boolean;
  paymentId: number;
  contentId: number;
  amountPaid: number;
  creatorReceives: number;
  settledAt: string;
  txHash?: string | null;
  splitTxHash?: string | null;
  settlementNetwork?: string | null;
}> {
  const config = await fetchPaymentConfig();
  const clerkId = requireClerkUserId();

  if (config.clientSideWallet && !config.mockMode) {
    await migrateLegacyServerWallet(clerkId);
    await ensureClientWallet(clerkId);
    const scheme = await getClientPaymentScheme(clerkId);
    const response = await payGatewayResource(
      `/api/payments/gateway/${contentId}`,
      scheme,
      config.chainId,
    );
    if (!response.ok) {
      const err = await response.json().catch(() => ({})) as {
        error?: string;
        code?: string;
        retryable?: boolean;
      };
      const e = new Error(err.error ?? `Unlock failed (${response.status})`) as Error & {
        code?: string;
        retryable?: boolean;
      };
      e.code = err.code;
      e.retryable = err.retryable;
      throw e;
    }
    return response.json();
  }

  const res = await apiFetch(`/api/payments/unlock-app/${contentId}`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as {
      error?: string;
      code?: string;
      retryable?: boolean;
    };
    const e = new Error(err.error ?? `Unlock failed (${res.status})`) as Error & {
      code?: string;
      retryable?: boolean;
    };
    e.code = err.code;
    e.retryable = err.retryable;
    throw e;
  }
  return res.json();
}

export async function retryContentSplit(contentId: number) {
  const res = await apiFetch(`/api/payments/retry-split/${contentId}`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string; code?: string };
    const e = new Error(err.error ?? `Retry failed (${res.status})`) as Error & { code?: string };
    e.code = err.code;
    throw e;
  }
  return res.json();
}

export async function unlockContentWithRetry(contentId: number, maxAttempts = 4) {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 3000 * attempt));
        const retried = await retryContentSplit(contentId);
        if ((retried as { success?: boolean }).success) return retried;
        continue;
      }
      const result = await unlockContentInApp(contentId);
      if ((result as { success?: boolean }).success) return result;
      throw new Error("Unlock did not complete");
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const retryable =
        (lastError as Error & { retryable?: boolean }).retryable ||
        (lastError as Error & { code?: string }).code === "SETTLEMENT_INCOMPLETE";
      if (!retryable || attempt >= maxAttempts - 1) throw lastError;
    }
  }
  throw lastError ?? new Error("Unlock failed");
}

/** @deprecated Only when server has MOCK_PAYMENTS=true */
export async function unlockContentMock(contentId: number): Promise<unknown> {
  const res = await apiFetch("/api/payments/unlock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentId, txHash: `mock-${Date.now()}` }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? "Unlock failed");
  }
  return res.json();
}
