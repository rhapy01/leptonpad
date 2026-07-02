/** client = keys in browser only; custodial = legacy server-encrypted keys (dev fallback). */
export type WalletMode = "client" | "custodial";

export function walletMode(): WalletMode {
  const mode = process.env.WALLET_MODE?.trim().toLowerCase();
  if (mode === "custodial") return "custodial";
  return "client";
}

export function isClientWalletMode(): boolean {
  return walletMode() === "client";
}

export function userUsesCustodialWallet(user: {
  walletEncryptedKey: string | null;
}): boolean {
  if (isClientWalletMode()) {
    return Boolean(user.walletEncryptedKey);
  }
  return true;
}
