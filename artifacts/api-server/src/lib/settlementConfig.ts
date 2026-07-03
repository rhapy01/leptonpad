import { createPublicClient, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { leptonSplitAbi } from "../contracts/leptonSplitAbi";
import { arcTestnet } from "./arcChain";
import { getSplitContractAddress, getPlatformWalletAddress } from "./leptonSplit";
import { getGatewaySellerAddress } from "./gatewaySellerFunding";
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

/** Validate settlement env: Gateway seller = platform EOA; split contract separate; owner key matches. */
export async function validateSettlementConfig(): Promise<void> {
  if (isMockPayments()) {
    logger.info("Settlement: mock payments enabled");
    return;
  }

  const contract = getSplitContractAddress();
  const seller = getGatewaySellerAddress();
  const platform = getPlatformWalletAddress();

  if (!contract) {
    logger.warn("Settlement misconfigured: set LEPTON_SPLIT_CONTRACT to the deployed LeptonSplit address");
    return;
  }

  if (!seller) {
    logger.warn(
      "Settlement misconfigured: set GATEWAY_SELLER_ADDRESS or PLATFORM_WALLET_ADDRESS (x402 seller EOA)",
    );
    return;
  }

  if (seller.toLowerCase() === contract.toLowerCase()) {
    logger.error(
      { seller, contract },
      "Settlement misconfigured: GATEWAY_SELLER_ADDRESS must be the platform EOA, not LeptonSplit",
    );
  }

  const ownerKey =
    process.env.GATEWAY_SELLER_PRIVATE_KEY ??
    process.env.SPLIT_OWNER_PRIVATE_KEY ??
    process.env.TREASURY_PRIVATE_KEY ??
    process.env.PRIVATE_KEYS;
  if (!ownerKey) {
    logger.warn("Settlement: no SPLIT_OWNER_PRIVATE_KEY — on-chain splits will fail");
    return;
  }

  const key = ownerKey.startsWith("0x") ? ownerKey : `0x${ownerKey}`;
  const account = privateKeyToAccount(key as `0x${string}`);

  if (account.address.toLowerCase() !== seller.toLowerCase()) {
    logger.error(
      { seller, keyAddress: account.address },
      "Settlement: seller private key must match GATEWAY_SELLER_ADDRESS / PLATFORM_WALLET_ADDRESS for Gateway withdraw",
    );
  }

  if (platform && platform.toLowerCase() !== seller.toLowerCase()) {
    logger.warn(
      { platform, seller },
      "Settlement: PLATFORM_WALLET_ADDRESS differs from Gateway seller — platform share still routes on-chain via LeptonSplit",
    );
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

    if (onChainOwner.toLowerCase() !== account.address.toLowerCase()) {
      logger.error(
        { onChainOwner, configuredOwner: account.address },
        "Settlement: SPLIT_OWNER_PRIVATE_KEY does not match LeptonSplit contract owner",
      );
    } else {
      logger.info(
        { contract, seller, owner: account.address, platform },
        "Settlement ready (x402 → Gateway seller → withdraw → LeptonSplit → splitPayment)",
      );
    }
  } catch (err) {
    logger.warn({ err }, "Settlement config validation skipped (RPC unavailable)");
  }
}
