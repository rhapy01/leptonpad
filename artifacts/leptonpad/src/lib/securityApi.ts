import { apiFetch } from "./apiFetch";

export interface SecurityStatus {
  deviceTrusted: boolean;
  firstDevice: boolean;
  trustedDeviceCount: number;
  totpEnabled: boolean;
  walletPinSet: boolean;
  walletPasskeySet: boolean;
  walletLockSet: boolean;
  walletUnlocked: boolean;
  requiresDeviceVerification: boolean;
  canVerifyNewDevice: boolean;
  totpRequiredForDeviceVerify?: boolean;
}

export async function fetchSecurityStatus(): Promise<SecurityStatus> {
  const res = await apiFetch("/api/security/status");
  if (!res.ok) throw new Error("Failed to load security status");
  return res.json() as Promise<SecurityStatus>;
}

export async function requestDeviceEmailOtp(): Promise<void> {
  const res = await apiFetch("/api/security/device/request-otp", { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Could not send email code");
  }
}

export async function verifyNewDevice(emailCode: string, totpCode?: string): Promise<void> {
  const res = await apiFetch("/api/security/device/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ emailCode, totpCode: totpCode?.trim() || undefined }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Device verification failed");
  }
}

export async function setupTotp(): Promise<{ secret: string; uri: string; instructions: string }> {
  const res = await apiFetch("/api/security/totp/setup", { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "TOTP setup failed");
  }
  return res.json();
}

export async function enableTotp(totpCode: string): Promise<void> {
  const res = await apiFetch("/api/security/totp/enable", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ totpCode }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Could not enable authenticator");
  }
}

export async function setWalletPin(pin: string, totpCode?: string): Promise<void> {
  const res = await apiFetch("/api/security/wallet-pin/set", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin, totpCode }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Could not set wallet lock");
  }
}

export async function verifyWalletPin(pin: string): Promise<void> {
  const res = await apiFetch("/api/security/wallet-pin/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string; code?: string };
    const e = new Error(err.error ?? "Incorrect PIN or password") as Error & { code?: string };
    e.code = err.code;
    throw e;
  }
}

export async function lockWallet(): Promise<void> {
  await apiFetch("/api/security/wallet-pin/lock", { method: "POST" });
}

export async function requestWalletPinResetOtp(): Promise<void> {
  const res = await apiFetch("/api/security/wallet-pin/request-reset-otp", { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Could not send reset code");
  }
}

export async function resetWalletPin(emailCode: string, pin: string): Promise<void> {
  const res = await apiFetch("/api/security/wallet-pin/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ emailCode, pin }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Could not reset wallet lock");
  }
}
