import { GatewayClient } from "@circle-fin/x402-batching/client";
import {
  createPublicClient,
  createWalletClient,
  formatUnits,
  http,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "./arcChain";
import { getPaymentConfig, isMockPayments } from "./gateway";
import { leptonSplitAbi } from "../contracts/leptonSplitAbi";
import { getPlatformWalletAddress, getSplitContractAddress } from "./leptonSplit";
import { logger } from "./logger";

function sellerPrivateKey(): Hex | null {
  const raw =
    process.env.GATEWAY_SELLER_PRIVATE_KEY ??
    process.env.SPLIT_OWNER_PRIVATE_KEY ??
    process.env.TREASURY_PRIVATE_KEY ??
    process.env.PRIVATE_KEYS;
  if (!raw) return null;
  return (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
}

/** x402 Gateway seller — platform EOA that accrues unlock revenue in Gateway. */
export function getGatewaySellerAddress(): Address | null {
  const explicit = process.env.GATEWAY_SELLER_ADDRESS;
  if (explicit) return explicit as Address;
  return getPlatformWalletAddress();
}

export function createGatewaySellerClient(): GatewayClient | null {
  if (isMockPayments()) return null;

  const seller = getGatewaySellerAddress();
  const key = sellerPrivateKey();
  if (!seller || !key) return null;

  const account = privateKeyToAccount(key);
  if (account.address.toLowerCase() !== seller.toLowerCase()) {
    logger.error(
      { seller, keyAddress: account.address },
      "Gateway seller private key does not match GATEWAY_SELLER_ADDRESS / PLATFORM_WALLET_ADDRESS",
    );
    return null;
  }

  const chainName = getPaymentConfig().chainName as "arcTestnet";
  return new GatewayClient({ chain: chainName, privateKey: key });
}

function fundingPublicClient() {
  return createPublicClient({ chain: arcTestnet, transport: http() });
}

function fundingWalletClient() {
  const key = sellerPrivateKey();
  if (!key) throw new Error("Gateway seller private key not configured");
  return createWalletClient({
    account: privateKeyToAccount(key),
    chain: arcTestnet,
    transport: http(),
  });
}

async function readSplitContractBalance(contract: Address): Promise<bigint> {
  return fundingPublicClient().readContract({
    address: contract,
    abi: leptonSplitAbi,
    functionName: "contractBalance",
  });
}

/**
 * Move USDC from the platform Gateway balance onto LeptonSplit so splitPayment can run.
 * Circle nanopayments credit the seller EOA in Gateway — not the split contract natively.
 */
export async function fundLeptonSplitFromGateway(amountUsdc: number): Promise<{
  funded: boolean;
  withdrawTxHash?: string;
  reason?: string;
}> {
  if (isMockPayments()) return { funded: true };

  const contract = getSplitContractAddress();
  if (!contract) return { funded: false, reason: "no-split-contract" };

  const needed = parseUnits(amountUsdc.toFixed(6), 6);
  const current = await readSplitContractBalance(contract);
  if (current >= needed) return { funded: true };

  const shortfall = needed - current;
  const shortfallUsdc = formatUnits(shortfall, 6);

  const client = createGatewaySellerClient();
  if (!client) {
    return { funded: false, reason: "no-gateway-seller-client" };
  }

  const balances = await client.getBalances();
  const available = Number.parseFloat(balances.gateway.formattedAvailable);
  if (available + 1e-9 < Number.parseFloat(shortfallUsdc)) {
    return {
      funded: false,
      reason: `gateway available ${balances.gateway.formattedAvailable} < ${shortfallUsdc} (batch settlement pending)`,
    };
  }

  const result = await client.withdraw(shortfallUsdc, { recipient: contract });
  logger.info(
    {
      amountUsdc: shortfallUsdc,
      contract,
      withdrawTxHash: result.mintTxHash,
      seller: getGatewaySellerAddress(),
    },
    "Withdrew Gateway earnings to LeptonSplit for atomic split",
  );

  const after = await readSplitContractBalance(contract);
  if (after < needed) {
    return {
      funded: false,
      withdrawTxHash: result.mintTxHash,
      reason: `contract balance ${after} still < ${needed} after Gateway withdraw`,
    };
  }

  return { funded: true, withdrawTxHash: result.mintTxHash };
}

/**
 * Backfill LeptonSplit when Gateway seller was misconfigured (payments credited to contract
 * address in Gateway ledger). Uses the seller EOA on-chain USDC only for the shortfall.
 */
export async function fundLeptonSplitFromSellerWallet(amountUsdc: number): Promise<boolean> {
  if (isMockPayments()) return true;

  const contract = getSplitContractAddress();
  const seller = getGatewaySellerAddress();
  if (!contract || !seller) return false;

  const needed = parseUnits(amountUsdc.toFixed(6), 6);
  const publicClient = fundingPublicClient();
  const current = await readSplitContractBalance(contract);
  if (current >= needed) return true;

  const shortfall = needed - current;
  const sellerBal = await publicClient.getBalance({ address: seller });
  if (sellerBal < shortfall) return false;

  const wallet = fundingWalletClient();
  const hash = await wallet.sendTransaction({
    to: contract,
    value: shortfall,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  logger.info(
    { contract, shortfall: formatUnits(shortfall, 6), txHash: hash },
    "Sent on-chain USDC to LeptonSplit (seller wallet backfill)",
  );
  return (await readSplitContractBalance(contract)) >= needed;
}
