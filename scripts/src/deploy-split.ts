/**
 * Compile and deploy LeptonSplit to Arc testnet.
 *
 * Usage (from repo root):
 *   cd artifacts/api-server
 *   node --import tsx ../../scripts/src/deploy-split.ts
 *
 * Requires in .env:
 *   SPLIT_OWNER_PRIVATE_KEY (or TREASURY_PRIVATE_KEY) — deployer + contract owner
 *   PLATFORM_WALLET_ADDRESS — receives platform share (5%)
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import solc from "solc";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

function loadEnvFile(file: string): void {
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
} as const;

function compileLeptonSplit(): { abi: unknown; bytecode: Hex } {
  const sourcePath = resolve(repoRoot, "contracts/LeptonSplit.sol");
  const source = readFileSync(sourcePath, "utf8");

  const input = {
    language: "Solidity",
    sources: { "LeptonSplit.sol": { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        "*": { "*": ["abi", "evm.bytecode.object"] },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input))) as {
    errors?: Array<{ severity: string; formattedMessage: string }>;
    contracts: Record<string, Record<string, { abi: unknown; evm: { bytecode: { object: string } } }>>;
  };

  const errors = output.errors?.filter((e) => e.severity === "error") ?? [];
  if (errors.length) {
    throw new Error(errors.map((e) => e.formattedMessage).join("\n"));
  }

  const artifact = output.contracts["LeptonSplit.sol"]?.LeptonSplit;
  if (!artifact?.evm?.bytecode?.object) {
    throw new Error("Compile failed — no bytecode");
  }

  return {
    abi: artifact.abi,
    bytecode: `0x${artifact.evm.bytecode.object}` as Hex,
  };
}

async function main() {
  const ownerKey = (process.env.SPLIT_OWNER_PRIVATE_KEY ?? process.env.TREASURY_PRIVATE_KEY) as
    | Hex
    | undefined;
  const platformWallet = process.env.PLATFORM_WALLET_ADDRESS;

  if (!ownerKey) {
    throw new Error("Set SPLIT_OWNER_PRIVATE_KEY or TREASURY_PRIVATE_KEY in .env");
  }
  if (!platformWallet) {
    throw new Error("Set PLATFORM_WALLET_ADDRESS in .env (receives platform 5% share)");
  }

  console.log("Compiling LeptonSplit.sol...");
  const { abi, bytecode } = compileLeptonSplit();

  const account = privateKeyToAccount(ownerKey);
  const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(),
  });

  console.log("Deploying to Arc testnet...");
  console.log(`  Deployer:  ${account.address}`);
  console.log(`  Platform:  ${platformWallet}`);

  const hash = await walletClient.deployContract({
    abi: abi as never,
    bytecode,
    args: [platformWallet as `0x${string}`],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const contractAddress = receipt.contractAddress;

  if (!contractAddress) {
    throw new Error("Deploy failed — no contract address");
  }

  console.log(`
LeptonSplit deployed
====================
Contract:  ${contractAddress}
Deploy tx: ${hash}

Add to your .env:

LEPTON_SPLIT_CONTRACT=${contractAddress}
GATEWAY_SELLER_ADDRESS=${contractAddress}

x402 payments now settle to the split contract on Arc.
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
