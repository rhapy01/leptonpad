/**
 * Deploy LeptonSplit to Arc testnet (no tsx required).
 * Run: node scripts/deploy-split.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import {
  createPublicClient,
  createWalletClient,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const require = createRequire(import.meta.url);
const solc = require("./deps/node_modules/solc");

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");

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

if (process.env.PRIVATE_KEYS && !process.env.TREASURY_PRIVATE_KEY) {
  process.env.TREASURY_PRIVATE_KEY = process.env.PRIVATE_KEYS.startsWith("0x")
    ? process.env.PRIVATE_KEYS
    : `0x${process.env.PRIVATE_KEYS}`;
}
if (process.env.PRIVATE_KEYS && !process.env.SPLIT_OWNER_PRIVATE_KEY) {
  process.env.SPLIT_OWNER_PRIVATE_KEY = process.env.TREASURY_PRIVATE_KEY;
}

const arcTestnet = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
};

function compile() {
  const source = readFileSync(resolve(repoRoot, "contracts/LeptonSplit.sol"), "utf8");
  const input = {
    language: "Solidity",
    sources: { "LeptonSplit.sol": { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = output.errors?.filter((e) => e.severity === "error") ?? [];
  if (errors.length) throw new Error(errors.map((e) => e.formattedMessage).join("\n"));
  const artifact = output.contracts["LeptonSplit.sol"].LeptonSplit;
  return {
    abi: artifact.abi,
    bytecode: `0x${artifact.evm.bytecode.object}`,
  };
}

async function main() {
  const ownerKey =
    process.env.SPLIT_OWNER_PRIVATE_KEY ??
    process.env.TREASURY_PRIVATE_KEY ??
    (process.env.PRIVATE_KEYS
      ? process.env.PRIVATE_KEYS.startsWith("0x")
        ? process.env.PRIVATE_KEYS
        : `0x${process.env.PRIVATE_KEYS}`
      : undefined);
  const platformWallet = process.env.PLATFORM_WALLET_ADDRESS;
  if (!ownerKey) throw new Error("SPLIT_OWNER_PRIVATE_KEY or TREASURY_PRIVATE_KEY required");
  if (!platformWallet) throw new Error("PLATFORM_WALLET_ADDRESS required");

  console.log("Compiling LeptonSplit.sol...");
  const { abi, bytecode } = compile();

  const account = privateKeyToAccount(ownerKey);
  const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(),
  });

  console.log(`Deploying from ${account.address} → platform ${platformWallet}`);
  const hash = await walletClient.deployContract({
    abi,
    bytecode,
    args: [platformWallet],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const contractAddress = receipt.contractAddress;
  if (!contractAddress) throw new Error("No contract address in receipt");

  console.log(`
LeptonSplit deployed
====================
Contract:  ${contractAddress}
Deploy tx: ${hash}

Add to .env:
LEPTON_SPLIT_CONTRACT=${contractAddress}
GATEWAY_SELLER_ADDRESS=${contractAddress}
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
