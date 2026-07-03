/**
 * Live test: fund LeptonSplit from Gateway / seller wallet, then splitPayment.
 * Run: node artifacts/api-server/scripts/test-split-live.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import {
  createPublicClient,
  createWalletClient,
  http,
  formatUnits,
  parseUnits,
  keccak256,
  toBytes,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");
const require = createRequire(import.meta.url);

function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv(resolve(repoRoot, ".env"));

const splitContract = process.env.LEPTON_SPLIT_CONTRACT?.trim();
let gatewaySeller =
  process.env.GATEWAY_SELLER_ADDRESS?.trim() ?? process.env.PLATFORM_WALLET_ADDRESS?.trim();
const platformWallet = process.env.PLATFORM_WALLET_ADDRESS?.trim();
if (
  splitContract &&
  gatewaySeller &&
  gatewaySeller.toLowerCase() === splitContract.toLowerCase() &&
  platformWallet
) {
  gatewaySeller = platformWallet;
  process.env.GATEWAY_SELLER_ADDRESS = platformWallet;
  console.log("[fix] GATEWAY_SELLER_ADDRESS corrected to platform wallet");
}

const ownerKeyRaw =
  process.env.SPLIT_OWNER_PRIVATE_KEY ??
  process.env.TREASURY_PRIVATE_KEY ??
  process.env.PRIVATE_KEYS;
if (!ownerKeyRaw) throw new Error("No SPLIT_OWNER / PRIVATE_KEYS in .env");
const ownerKey = (ownerKeyRaw.startsWith("0x") ? ownerKeyRaw : `0x${ownerKeyRaw}`);

const arcTestnet = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
};

const leptonSplitAbi = [
  {
    name: "contractBalance",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "splitPayment",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "settlementId", type: "bytes32" },
      { name: "contentId", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "settlementClaimed",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "event",
    name: "SplitPayment",
    inputs: [
      { name: "settlementId", type: "bytes32", indexed: true },
      { name: "contentId", type: "uint256", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "total", type: "uint256", indexed: false },
      { name: "toCreator", type: "uint256", indexed: false },
      { name: "toPlatform", type: "uint256", indexed: false },
    ],
  },
];

const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
const ownerAccount = privateKeyToAccount(ownerKey);
const ownerClient = createWalletClient({
  account: ownerAccount,
  chain: arcTestnet,
  transport: http(),
});

const contract = splitContract;
const seller = gatewaySeller;

console.log("Platform seller:", seller);
console.log("LeptonSplit:", contract);
console.log("Owner key address:", ownerAccount.address);

// Pending payment from production DB
const { Pool } = require(require.resolve("pg", { paths: [resolve(repoRoot, "lib/db")] }));
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const { rows } = await pool.query(`
  SELECT id, content_id, reader_id, amount, tx_hash, split_tx_hash
  FROM payments
  WHERE tx_hash IS NOT NULL AND split_tx_hash IS NULL
  ORDER BY paid_at ASC
`);
await pool.end();

if (!rows.length) {
  console.log("No pending splits in DB.");
  process.exit(0);
}

console.log(`Found ${rows.length} pending payment(s)\n`);

for (const payment of rows) {
const contentId = payment.content_id;
const amountUsdc = Number(payment.amount);
const settlementRef = payment.tx_hash;
const settlementId =
  settlementRef.startsWith("0x") && settlementRef.length === 66
    ? settlementRef
    : keccak256(toBytes(settlementRef));
const amount = parseUnits(amountUsdc.toFixed(6), 6);

console.log("\nPending payment:", {
  id: payment.id,
  contentId,
  amountUsdc,
  settlementRef,
  settlementId,
});

const claimed = await publicClient.readContract({
  address: contract,
  abi: leptonSplitAbi,
  functionName: "settlementClaimed",
  args: [settlementId],
});
if (claimed) {
  console.log("Settlement already claimed on-chain — skipping.");
  continue;
}

let balance = await publicClient.readContract({
  address: contract,
  abi: leptonSplitAbi,
  functionName: "contractBalance",
});
console.log("\nContract balance before:", formatUnits(balance, 6), "USDC");

if (balance < amount) {
  const shortfall = amount - balance;
  const shortfallUsdc = formatUnits(shortfall, 6);
  console.log("Need to fund:", shortfallUsdc, "USDC");

  let funded = false;

  try {
    const x402Path = require.resolve("@circle-fin/x402-batching/client", {
      paths: [resolve(repoRoot, "artifacts/api-server")],
    });
    const { GatewayClient } = await import(pathToFileURL(x402Path).href);
    const chainName = process.env.GATEWAY_CHAIN_NAME ?? "arcTestnet";
    const gw = new GatewayClient({ chain: chainName, privateKey: ownerKey });
    const balances = await gw.getBalances();
    console.log(
      "Gateway available:",
      balances.gateway.formattedAvailable,
      "total:",
      balances.gateway.formattedTotal,
    );

    const available = Number.parseFloat(balances.gateway.formattedAvailable);
    if (available + 1e-9 >= Number.parseFloat(shortfallUsdc)) {
      const withdraw = await gw.withdraw(shortfallUsdc, { recipient: contract });
      console.log("Gateway withdraw tx:", withdraw.mintTxHash);
      funded = true;
    }
  } catch (err) {
    console.log("Gateway withdraw skipped:", err instanceof Error ? err.message : err);
  }

  if (!funded) {
    const sellerBal = await publicClient.getBalance({ address: seller });
    console.log("Seller on-chain balance:", formatUnits(sellerBal, 6), "USDC");
    if (sellerBal >= shortfall) {
      const hash = await ownerClient.sendTransaction({
        to: contract,
        value: shortfall,
      });
      console.log("Seller wallet → LeptonSplit tx:", hash);
      await publicClient.waitForTransactionReceipt({ hash });
      funded = true;
    }
  }

  balance = await publicClient.readContract({
    address: contract,
    abi: leptonSplitAbi,
    functionName: "contractBalance",
  });
  console.log("Contract balance after fund:", formatUnits(balance, 6), "USDC");

  if (balance < amount) {
    console.error("FAIL: still insufficient contract balance for split");
    process.exit(1);
  }
}

console.log("\nExecuting splitPayment...");
const splitHash = await ownerClient.writeContract({
  address: contract,
  abi: leptonSplitAbi,
  functionName: "splitPayment",
  args: [settlementId, BigInt(contentId), amount],
});
console.log("splitPayment tx submitted:", splitHash);
const receipt = await publicClient.waitForTransactionReceipt({ hash: splitHash });
console.log("splitPayment status:", receipt.status);

const events = await publicClient.getContractEvents({
  address: contract,
  abi: leptonSplitAbi,
  eventName: "SplitPayment",
  fromBlock: receipt.blockNumber,
  toBlock: receipt.blockNumber,
});
console.log(
  "SplitPayment event:",
  events[0]
    ? {
        contentId: events[0].args.contentId?.toString(),
        total: formatUnits(events[0].args.total ?? 0n, 6),
        toCreator: formatUnits(events[0].args.toCreator ?? 0n, 6),
        toPlatform: formatUnits(events[0].args.toPlatform ?? 0n, 6),
      }
    : "none",
);

console.log("\nSUCCESS — view on Arcscan:");
console.log(`https://testnet.arcscan.app/tx/${splitHash}`);

// Update DB
const pool2 = new Pool({ connectionString: process.env.DATABASE_URL });
await pool2.query(`UPDATE payments SET split_tx_hash = $1 WHERE id = $2`, [
  splitHash,
  payment.id,
]);
await pool2.end();
console.log("DB updated: payment", payment.id, "split_tx_hash =", splitHash);
console.log("---");
}

console.log("\nAll done.");
