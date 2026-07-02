import { getPaymentConfig, isMockPayments } from "./gateway";
import { getSplitContractAddress, requiresAtomicSplit } from "./leptonSplit";

export type SettlementRailInfo = {
  enabled: boolean;
  mockMode: boolean;
  chainId: number;
  chainName: string;
  network: string;
  splitContract: string | null;
  explorerBase: string;
  flow: string[];
  creatorShareBps: number;
};

/** Public description of x402 → LeptonSplit → creator settlement for UI. */
export function getSettlementRailInfo(): SettlementRailInfo {
  const config = getPaymentConfig();
  const splitContract = getSplitContractAddress();

  return {
    enabled: requiresAtomicSplit(),
    mockMode: isMockPayments(),
    chainId: config.chainId,
    chainName: config.chainName,
    network: config.network,
    splitContract: splitContract ?? config.sellerAddress,
    explorerBase: "https://testnet.arcscan.app",
    creatorShareBps: 9500,
    flow: [
      "Reader pays via Circle Gateway (x402)",
      "USDC settles to LeptonSplit on Arc",
      "splitPayment sends 95% to creator wallet (100% if verified at publish)",
      "Access to read again stays in your Collection — off-chain",
    ],
  };
}
