import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

process.env.NODE_ENV = "production";
process.env.PORT = process.env.PORT ?? "25139";
process.env.BASE_PATH = process.env.BASE_PATH ?? "/";
process.env.API_PORT = process.env.API_PORT ?? "8787";

function run(cmd, cwd = root) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd, stdio: "inherit", env: { ...process.env } });
}

run("pnpm exec tsc -b lib/db lib/api-zod lib/api-client-react");
run("node scripts/push-security-schema.mjs");
run("pnpm --filter @workspace/api-server run build");
run("pnpm --filter @workspace/leptonpad run build");
