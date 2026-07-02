import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "drizzle-kit";

const configDir = dirname(fileURLToPath(import.meta.url));
const rootEnv = join(configDir, "../../.env");

if (!process.env.DATABASE_URL && existsSync(rootEnv)) {
  for (const line of readFileSync(rootEnv, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      if (trimmed.startsWith("postgresql://") || trimmed.startsWith("postgres://")) {
        process.env.DATABASE_URL = trimmed;
      }
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set in the root .env file");
}

export default defineConfig({
  schema: [
    join(configDir, "src/schema/users.ts"),
    join(configDir, "src/schema/categories.ts"),
    join(configDir, "src/schema/content.ts"),
    join(configDir, "src/schema/payments.ts"),
    join(configDir, "src/schema/ai_suggestions.ts"),
    join(configDir, "src/schema/security.ts"),
  ],
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
