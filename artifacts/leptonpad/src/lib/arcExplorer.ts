/** Arc Testnet block explorer links for on-chain settlement receipts. */

export const ARC_EXPLORER_TX = "https://testnet.arcscan.app/tx";

export function arcTxExplorerUrl(txHash: string | null | undefined): string | null {
  if (!txHash || txHash.startsWith("mock-")) return null;
  return `${ARC_EXPLORER_TX}/${txHash}`;
}
