import { createPublicClient, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { leptonSplitAbi } from "../contracts/leptonSplitAbi";
import { arcTestnet } from "./arcChain";
import { getSplitContractAddress, getPlatformWalletAddress } from "./leptonSplit";
import { isMockPayments } from "./gateway";
import { logger } from "./logger";

/** Parse x402 Gateway payment amount (decimal or micro-USDC) into USDC float. */
export function parseGatewayAmountUsdc(
  amount: string | undefined,
  fallbackPrice: number,
): number {
  if (!amount) return fallbackPrice;

  const trimmed = amount.trim();
  const withoutSymbol = trimmed.replace(/^\$/, "");
  const n = Number.parseFloat(withoutSymbol);
  if (!Number.isFinite(n) || n <= 0) return fallbackPrice;

  // Facilitator may send atomic units (6 decimals) as an integer string
  if (/^\d+$/.test(withoutSymbol) && n >= 10_000) {
    return n / 1_000_000;
  }

  return n;
}

/** Validate dual-architecture env: x402 seller === LeptonSplit contract, owner key matches. */
export async function validateSettlementConfig(): Promise<void> {
  if (isMockPayments()) {
    logger.info("Settlement: mock payments enabled");
    return;
  }

  const contract = getSplitContractAddress();
  const seller = process.env.GATEWAY_SELLER_ADDRESS;
  const splitEnv = process.env.LEPTON_SPLIT_CONTRACT;

  if (!contract) {
    logger.warn(
      "Settlement misconfigured: set LEPTON_SPLIT_CONTRACT and GATEWAY_SELLER_ADDRESS to the deployed LeptonSplit address",
    );
    return;
  }

  if (seller && seller.toLowerCase() !== contract.toLowerCase()) {
    logger.error(
      { seller, contract },
      "Settlement misconfigured: GATEWAY_SELLER_ADDRESS must equal LEPTON_SPLIT_CONTRACT (dual-architecture seller is the split contract)",
    );
  }

  if (splitEnv && splitEnv.toLowerCase() !== contract.toLowerCase()) {
    logger.error(
      { splitEnv, contract },
      "Settlement misconfigured: LEPTON_SPLIT_CONTRACT mismatch",
    );
  }

  const ownerKey =
    process.env.SPLIT_OWNER_PRIVATE_KEY ??
    process.env.TREASURY_PRIVATE_KEY ??
    process.env.PRIVATE_KEYS;
  if (!ownerKey) {
    logger.warn("Settlement: no SPLIT_OWNER_PRIVATE_KEY — on-chain splits will fail");
    return;
  }

  const platform = getPlatformWalletAddress();
  if (!platform) {
    logger.warn("Settlement: PLATFORM_WALLET_ADDRESS not set");
  }

  try {
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
    const code = await publicClient.getBytecode({ address: contract as Address });
    if (!code || code === "0x") {
      logger.error({ contract }, "Settlement: LEPTON_SPLIT_CONTRACT has no bytecode on Arc");
      return;
    }

    const onChainOwner = await publicClient.readContract({
      address: contract as Address,
      abi: leptonSplitAbi,
      functionName: "owner",
    });

    const key = ownerKey.startsWith("0x") ? ownerKey : `0x${ownerKey}`;
    const account = privateKeyToAccount(key as `0x${string}`);
    if (onChainOwner.toLowerCase() !== account.address.toLowerCase()) {
      logger.error(
        { onChainOwner, configuredOwner: account.address },
        "Settlement: SPLIT_OWNER_PRIVATE_KEY does not match LeptonSplit contract owner",
      );
    } else {
      logger.info(
        { contract, owner: account.address, platform },
        "Settlement dual-architecture ready (x402 → contract → splitPayment)",
      );
    }
  } catch (err) {
    logger.warn({ err }, "Settlement config validation skipped (RPC unavailable)");
  }
}
