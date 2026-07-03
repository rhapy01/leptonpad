/**
 * Test Vercel Blob upload using .env credentials.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
}

const token = process.env.BLOB_READ_WRITE_TOKEN;
let storeId = process.env.BLOB_STORE_ID?.replace(/^store_/, "") ?? "";
if (!storeId && token) storeId = token.split("_")[3] ?? "";

if (!token || !storeId) {
  console.error("BLOB_READ_WRITE_TOKEN / BLOB_STORE_ID missing");
  process.exit(1);
}

const buffer = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const pathname = `leptonpad/test/${randomUUID()}.png`;
const params = new URLSearchParams({ pathname });

const res = await fetch(`https://vercel.com/api/blob/?${params}`, {
  method: "PUT",
  headers: {
    authorization: `Bearer ${token}`,
    "x-api-version": "12",
    "x-vercel-blob-store-id": storeId,
    "x-content-length": String(buffer.length),
    "x-vercel-blob-access": "public",
    "x-add-random-suffix": "0",
    "x-content-type": "image/png",
  },
  body: buffer,
});

const text = await res.text();
console.log("status:", res.status);
console.log(text.slice(0, 500));
