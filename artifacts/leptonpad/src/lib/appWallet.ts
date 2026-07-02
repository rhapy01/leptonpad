import { apiFetch } from "./apiFetch";

export interface AppWalletStatus {
  address: string | null;
  gatewayReady: boolean;
  gatewayAvailable: string | null;
  walletBalance: string | null;
  onChainBalance?: string | null;
  mockMode: boolean;
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
}

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

export async function activateAppWallet(): Promise<{
  ready: boolean;
  gatewayAvailable: string;
  walletBalance: string;
  funded: boolean;
}> {
  const res = await apiFetch("/api/wallet/activate", {
    method: "POST",
  });
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

/** Retry on-chain creator split without charging the reader again. */
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
