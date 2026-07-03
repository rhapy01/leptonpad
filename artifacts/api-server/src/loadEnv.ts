import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function loadEnvFile(file: string): void {
  if (!existsSync(file)) return;
  let content = readFileSync(file, "utf8");
  if (content.charCodeAt(0) === 0xfeff) content = content.slice(1);

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      if (trimmed.startsWith("postgresql://") || trimmed.startsWith("postgres://")) {
        if (!process.env.DATABASE_URL) process.env.DATABASE_URL = trimmed;
      }
      continue;
    }

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    // Prefer .env when the variable is unset or empty in the process environment.
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const distDir = dirname(fileURLToPath(import.meta.url));
const envCandidates = [
  resolve(distDir, "../../../.env"), // repo root from dist/index.mjs
  resolve(distDir, "../../.env"),   // artifacts/api-server/.env
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "../../.env"),
];

let loadedFrom: string | null = null;
for (const candidate of envCandidates) {
  if (existsSync(candidate)) {
    loadEnvFile(candidate);
    loadedFrom = candidate;
    break;
  }
}

if (loadedFrom && process.env.NODE_ENV !== "production") {
  console.info(`[env] Loaded ${loadedFrom}`);
}

// Single funded hackathon key — PRIVATE_KEYS takes precedence for treasury/split owner
if (process.env.PRIVATE_KEYS && !process.env.TREASURY_PRIVATE_KEY) {
  process.env.TREASURY_PRIVATE_KEY = process.env.PRIVATE_KEYS.startsWith("0x")
    ? process.env.PRIVATE_KEYS
    : `0x${process.env.PRIVATE_KEYS}`;
}
if (process.env.PRIVATE_KEYS && !process.env.SPLIT_OWNER_PRIVATE_KEY) {
  process.env.SPLIT_OWNER_PRIVATE_KEY = process.env.TREASURY_PRIVATE_KEY;
}

// Gateway seller must be the platform EOA — not LeptonSplit (Circle credits Gateway balance, not contract receive()).
const splitContract = process.env.LEPTON_SPLIT_CONTRACT?.trim();
const gatewaySeller = process.env.GATEWAY_SELLER_ADDRESS?.trim();
const platformWallet = process.env.PLATFORM_WALLET_ADDRESS?.trim();
if (
  splitContract &&
  gatewaySeller &&
  gatewaySeller.toLowerCase() === splitContract.toLowerCase() &&
  platformWallet &&
  platformWallet.toLowerCase() !== gatewaySeller.toLowerCase()
) {
  process.env.GATEWAY_SELLER_ADDRESS = platformWallet;
  console.warn(
    `[settlement] GATEWAY_SELLER_ADDRESS was LeptonSplit — corrected to PLATFORM_WALLET_ADDRESS (${platformWallet})`,
  );
}

// Frontend uses PORT; API uses API_PORT from the single root .env
if (process.env.API_PORT) {
  process.env.PORT = process.env.API_PORT;
}

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "development";
}

const isProd = process.env.NODE_ENV === "production";

if (isProd && process.env.MOCK_PAYMENTS === "true") {
  throw new Error("MOCK_PAYMENTS cannot be enabled in production");
}

if (isProd) {
  const walletSecret = process.env.WALLET_ENCRYPTION_SECRET?.trim();
  const clientOnly = process.env.WALLET_MODE?.trim().toLowerCase() === "client";
  if (!clientOnly) {
    if (!walletSecret || walletSecret.length < 32) {
      throw new Error("WALLET_ENCRYPTION_SECRET must be at least 32 characters for account-linked wallets");
    }
  }
  if (!process.env.INITIAL_ADMIN_EMAILS?.trim()) {
    console.warn("[security] INITIAL_ADMIN_EMAILS is unset — no auto-admin promotion in production");
  }
}

if (process.env.MOCK_PAYMENTS !== "true" && !process.env.LEPTON_SPLIT_CONTRACT && !process.env.GATEWAY_SELLER_ADDRESS) {
  console.warn(
    "[settlement] LEPTON_SPLIT_CONTRACT / GATEWAY_SELLER_ADDRESS not set. " +
      "Deploy LeptonSplit: node --import tsx scripts/src/deploy-split.ts",
  );
}
