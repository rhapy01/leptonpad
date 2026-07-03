import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { apiFetch } from "./apiFetch";

export async function registerWalletPasskey(): Promise<void> {
  const optionsRes = await apiFetch("/api/security/wallet-passkey/register-options", { method: "POST" });
  if (!optionsRes.ok) {
    const err = await optionsRes.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Could not start passkey setup");
  }
  const options = await optionsRes.json();
  const attestation = await startRegistration({ optionsJSON: options });
  const verifyRes = await apiFetch("/api/security/wallet-passkey/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(attestation),
  });
  if (!verifyRes.ok) {
    const err = await verifyRes.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Passkey registration failed");
  }
}

export async function unlockWalletWithPasskey(): Promise<void> {
  const optionsRes = await apiFetch("/api/security/wallet-passkey/auth-options", { method: "POST" });
  if (!optionsRes.ok) {
    const err = await optionsRes.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "No passkey on this account");
  }
  const options = await optionsRes.json();
  const assertion = await startAuthentication({ optionsJSON: options });
  const verifyRes = await apiFetch("/api/security/wallet-passkey/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(assertion),
  });
  if (!verifyRes.ok) {
    const err = await verifyRes.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Passkey verification failed");
  }
}
