/**
 * Push root .env variables to the linked Vercel project.
 * Usage: node scripts/push-vercel-env.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env");

if (!existsSync(envPath)) {
  console.error("Missing .env at repo root");
  process.exit(1);
}

function parseEnvFile(file) {
  const vars = new Map();
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
    vars.set(key, value);
  }
  return vars;
}

const SENSITIVE = new Set([
  "DATABASE_URL",
  "CLERK_SECRET_KEY",
  "PRIVATE_KEYS",
  "TREASURY_PRIVATE_KEY",
  "SPLIT_OWNER_PRIVATE_KEY",
  "WALLET_ENCRYPTION_SECRET",
  "BLOB_READ_WRITE_TOKEN",
  "SMTP_PASS",
  "OPENAI_API_KEY",
  "CLOUDINARY_URL",
]);

const PRODUCTION_BASE = {
  PUBLIC_URL: "https://lepton-pad.vercel.app",
  APP_URL: "https://lepton-pad.vercel.app",
  INITIAL_ADMIN_EMAILS: "akintoyeisaac5@gmail.com",
  WALLET_MODE: "custodial",
  MOCK_PAYMENTS: "false",
};

function productionOverrides(vars) {
  const overrides = { ...PRODUCTION_BASE };
  const pk =
    vars.get("CLERK_PUBLISHABLE_KEY") ?? vars.get("VITE_CLERK_PUBLISHABLE_KEY") ?? "";
  // Clerk proxy only applies to production Clerk instances (pk_live_).
  if (pk.startsWith("pk_live_")) {
    overrides.VITE_CLERK_PROXY_URL = "https://lepton-pad.vercel.app/api/__clerk";
  }
  return overrides;
}

const TARGETS = (process.argv.includes("--production-only")
  ? ["production"]
  : process.argv.includes("--development-only")
    ? ["development"]
    : ["production", "preview", "development"]);
const vars = parseEnvFile(envPath);
const PRODUCTION_ONLY = productionOverrides(vars);

// Frontend reads VITE_CLERK_PUBLISHABLE_KEY; Clerk CLI may write VITE_PUBLIC_* instead.
if (!vars.has("VITE_CLERK_PUBLISHABLE_KEY")) {
  const pk =
    vars.get("VITE_PUBLIC_CLERK_PUBLISHABLE_KEY") ?? vars.get("CLERK_PUBLISHABLE_KEY");
  if (pk) vars.set("VITE_CLERK_PUBLISHABLE_KEY", pk);
}

function addVar(key, value, target) {
  const useSensitive = SENSITIVE.has(key) && target !== "development";
  const previewAllBranches = target === "preview" ? ' ""' : "";
  const sensitiveFlag = useSensitive ? " --sensitive" : "";

  const result =
    process.platform === "win32"
      ? spawnSync(
          "cmd.exe",
          [
            "/d",
            "/s",
            "/c",
            `npx vercel env add ${key} ${target}${previewAllBranches} --force --yes${sensitiveFlag}`,
          ],
          {
            cwd: root,
            input: value,
            stdio: ["pipe", "pipe", "pipe"],
            encoding: "utf8",
            windowsHide: true,
          },
        )
      : spawnSync(
          "npx",
          [
            "vercel",
            "env",
            "add",
            key,
            target,
            ...(target === "preview" ? [""] : []),
            "--force",
            "--yes",
            ...(useSensitive ? ["--sensitive"] : []),
          ],
          {
            cwd: root,
            input: value,
            stdio: ["pipe", "pipe", "pipe"],
            encoding: "utf8",
          },
        );

  const out = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const added =
    out.includes("Added Environment Variable") ||
    out.includes("Overrode Environment Variable");

  if (
    target === "preview" &&
    out.includes("does not have a connected Git repository")
  ) {
    console.log(`SKIP ${key} [preview] (no Git repo linked on Vercel)`);
    return true;
  }

  if (result.status !== 0 && !added) {
    console.error(`FAIL ${key} [${target}]: ${out.trim()}`);
    return false;
  }
  console.log(`OK   ${key} [${target}]`);
  return true;
}

let ok = 0;
let fail = 0;

for (const target of TARGETS) {
  console.log(`\n=== ${target} ===`);
  for (const [key, value] of vars) {
    if (target === "production" && key in PRODUCTION_ONLY) continue;
    if (!value) continue;
    if (addVar(key, value, target)) ok++;
    else fail++;
  }
  if (target === "production") {
    for (const [key, value] of Object.entries(PRODUCTION_ONLY)) {
      if (addVar(key, value, target)) ok++;
      else fail++;
    }
  }
}

console.log(`\nDone: ${ok} set, ${fail} failed`);
if (fail > 0) process.exit(1);

console.log("\nRedeploy to apply: npx vercel deploy --prod");
