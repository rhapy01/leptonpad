import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, http, parseUnits, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { defineChain } from "viem";

const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../../../.env");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      const key = l.slice(0, i).trim();
      let val = l.slice(i + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return [key, val];
    }),
);

const raw = env.TREASURY_PRIVATE_KEY ?? env.PRIVATE_KEYS;
const key = (raw.startsWith("0x") ? raw : `0x${raw}`);
const account = privateKeyToAccount(key);
const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http() });

const userAddr = "0x209aa115E34886c9555fb51C3890722B8B785253";

const treasuryBal = await publicClient.getBalance({ address: account.address });
const userBal = await publicClient.getBalance({ address: userAddr });

console.log("treasury", account.address, formatUnits(treasuryBal, 6), "USDC");
console.log("user", userAddr, formatUnits(userBal, 6), "USDC");

if (Number(formatUnits(treasuryBal, 6)) >= 1) {
  const hash = await walletClient.sendTransaction({
    to: userAddr,
    value: parseUnits("1", 6),
  });
  console.log("sent 1 USDC tx", hash);
  await publicClient.waitForTransactionReceipt({ hash });
  const userBal2 = await publicClient.getBalance({ address: userAddr });
  console.log("user after fund", formatUnits(userBal2, 6), "USDC");
}
