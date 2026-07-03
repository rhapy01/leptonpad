/** User-facing wallet unlock terminology (PIN, password, passkey, fingerprint). */
export const WALLET_LOCK_LABEL = "PIN, password, passkey, or fingerprint";
export const WALLET_LOCK_SHORT = "PIN, password, or passkey";

export function walletLockConfigured(pinSet: boolean, passkeySet: boolean): boolean {
  return pinSet || passkeySet;
}

export function isWebAuthnAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.PublicKeyCredential !== "undefined";
}
