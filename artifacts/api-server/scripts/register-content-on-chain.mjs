/**
 * Register all published paid content on LeptonSplit (one-time backfill after redeploy).
 * Run from repo root: pnpm --filter @workspace/api-server run register-content
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import {
  createPublicClient,
  createWalletClient,
  http,
  zeroAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");
const { Pool } = require(require.resolve("pg", { paths: [resolve(repoRoot, "lib/db")] }));

function loadEnvFile(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(resolve(repoRoot, ".env"));

const arcTestnet = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
};

const leptonSplitAbi = [
  {
    type: "function",
    name: "contentCreator",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "registerContentCreator",
    inputs: [
      { name: "contentId", type: "uint256" },
      { name: "creator", type: "address" },
      { name: "bps", type: "uint16" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
];

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  const contract = process.env.LEPTON_SPLIT_CONTRACT;
  const platformWallet = process.env.PLATFORM_WALLET_ADDRESS;
  const ownerKey =
    process.env.SPLIT_OWNER_PRIVATE_KEY ??
    process.env.TREASURY_PRIVATE_KEY ??
    process.env.PRIVATE_KEYS;
  if (!dbUrl || !contract || !platformWallet || !ownerKey) {
    throw new Error("DATABASE_URL, LEPTON_SPLIT_CONTRACT, PLATFORM_WALLET_ADDRESS, PRIVATE_KEYS required");
  }

  const key = ownerKey.startsWith("0x") ? ownerKey : `0x${ownerKey}`;
  const account = privateKeyToAccount(key);
  const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(),
  });

  const pool = new Pool({ connectionString: dbUrl });
  const { rows } = await pool.query(
    `SELECT c.id, c.creator_id, c.price, COALESCE(u.verified, false) AS verified,
            COALESCE(u.wallet_address, $1) AS wallet_address
     FROM content c
     LEFT JOIN users u ON u.clerk_id = c.creator_id
     WHERE c.published = true AND CAST(c.price AS numeric) > 0
     ORDER BY c.id`,
    [platformWallet],
  );

  console.log(`Found ${rows.length} published paid items to register`);

  for (const row of rows) {
    const contentId = row.id;
    const creatorWallet = row.wallet_address ?? platformWallet;
    const bps = row.verified ? 10_000 : 9_500;

    const onChain = await publicClient.readContract({
      address: contract,
      abi: leptonSplitAbi,
      functionName: "contentCreator",
      args: [BigInt(contentId)],
    });

    if (onChain !== zeroAddress) {
      console.log(`  #${contentId} already registered → ${onChain}`);
      continue;
    }

    const hash = await walletClient.writeContract({
      address: contract,
      abi: leptonSplitAbi,
      functionName: "registerContentCreator",
      args: [BigInt(contentId), creatorWallet, bps],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`  #${contentId} registered → ${creatorWallet} (${bps} bps) tx ${hash}`);
  }

  await pool.end();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
