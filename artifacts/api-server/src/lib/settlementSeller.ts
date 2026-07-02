import { getPaymentConfig } from "./gateway";

/** Arc Testnet explorer base URL for settlement receipts. */
export const ARC_EXPLORER_TX_URL = "https://testnet.arcscan.app/tx";

export function arcTxUrl(txHash: string | null | undefined): string | null {
  if (!txHash || txHash.startsWith("mock-")) return null;
  return `${ARC_EXPLORER_TX_URL}/${txHash}`;
}

/**
 * x402 seller address — the LeptonSplit contract.
 * Gateway settles full payment to the contract; splitPayment atomically disburses shares.
 */
export async function resolveSellerAddress(_creatorId: string): Promise<string | null> {
  return getPaymentConfig().sellerAddress;
}
