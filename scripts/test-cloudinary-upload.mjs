/**
 * Test Cloudinary signed upload using .env credentials.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";

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

const url = process.env.CLOUDINARY_URL ?? "";
const match = url.match(/^cloudinary:\/\/([^:]+):([^@]+)@([^/?#]+)/);
if (!match) {
  console.error("CLOUDINARY_URL missing or invalid");
  process.exit(1);
}

const apiKey = decodeURIComponent(match[1]);
const apiSecret = decodeURIComponent(match[2]);
const cloudName = match[3];
const userId = "test-user";
const folder = `leptonpad/${userId}`;
const publicId = randomUUID();
const timestamp = Math.round(Date.now() / 1000);

// 1x1 red PNG
const buffer = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const signature = createHash("sha1")
  .update(`folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
  .digest("hex");

const form = new FormData();
form.append("file", new Blob([buffer], { type: "image/png" }), "test.png");
form.append("api_key", apiKey);
form.append("timestamp", String(timestamp));
form.append("signature", signature);
form.append("folder", folder);
form.append("public_id", publicId);

const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
  method: "POST",
  body: form,
});

const text = await res.text();
console.log("as-parsed:", res.status, text.slice(0, 200));

// Keys may be swapped in CLOUDINARY_URL — try reversed
const publicId2 = randomUUID();
const sig2 = createHash("sha1")
  .update(`folder=${folder}&public_id=${publicId2}&timestamp=${timestamp}${apiKey}`)
  .digest("hex");
const form2 = new FormData();
form2.append("file", new Blob([buffer], { type: "image/png" }), "test.png");
form2.append("api_key", apiSecret);
form2.append("timestamp", String(timestamp));
form2.append("signature", sig2);
form2.append("folder", folder);
form2.append("public_id", publicId2);
const res2 = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
  method: "POST",
  body: form2,
});
console.log("swapped:", res2.status, (await res2.text()).slice(0, 200));
