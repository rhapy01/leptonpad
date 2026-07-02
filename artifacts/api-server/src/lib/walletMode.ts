/** custodial (default) = encrypted key in Postgres, follows Clerk login on any device. */
/** client = optional browser-only keys (IndexedDB); does not sync across devices. */
export type WalletMode = "client" | "custodial";

export function walletMode(): WalletMode {
  const mode = process.env.WALLET_MODE?.trim().toLowerCase();
  if (mode === "client") return "client";
  return "custodial";
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
