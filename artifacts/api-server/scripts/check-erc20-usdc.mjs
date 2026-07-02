import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, http, formatUnits, erc20Abi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { defineChain } from "viem";

const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { decimals: 18, name: "USDC", symbol: "USDC" },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
});

const USDC = "0x3600000000000000000000000000000000000000";
const userAddr = "0x209aa115E34886c9555fb51C3890722B8B785253";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, "../../../.env"), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    }),
);

const raw = env.TREASURY_PRIVATE_KEY ?? env.PRIVATE_KEYS;
const key = raw.startsWith("0x") ? raw : `0x${raw}`;
const treasury = privateKeyToAccount(key);
const client = createPublicClient({ chain: arcTestnet, transport: http() });

const nativeTreasury = await client.getBalance({ address: treasury.address });
const nativeUser = await client.getBalance({ address: userAddr });
const ercTreasury = await client.readContract({
  address: USDC,
  abi: erc20Abi,
  functionName: "balanceOf",
  args: [treasury.address],
});
const ercUser = await client.readContract({
  address: USDC,
  abi: erc20Abi,
  functionName: "balanceOf",
  args: [userAddr],
});

console.log("treasury", treasury.address);
console.log("  native(18):", formatUnits(nativeTreasury, 18));
console.log("  erc20(6):", formatUnits(ercTreasury, 6));
console.log("user", userAddr);
console.log("  native(18):", formatUnits(nativeUser, 18));
console.log("  erc20(6):", formatUnits(ercUser, 6));
