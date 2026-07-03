/**
 * Verify Cloudinary upload via SDK + credential normalization.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { v2 as cloudinary } from "cloudinary";

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

function normalize(config) {
  const keyHasLetters = /[a-zA-Z]/.test(config.apiKey);
  const secretIsNumeric = /^\d{8,}$/.test(config.apiSecret);
  if (keyHasLetters && secretIsNumeric) {
    return { cloudName: config.cloudName, apiKey: config.apiSecret, apiSecret: config.apiKey };
  }
  return config;
}

const url = process.env.CLOUDINARY_URL ?? "";
const match = url.match(/^cloudinary:\/\/([^:]+):([^@]+)@([^/?#]+)/);
if (!match) {
  console.error("CLOUDINARY_URL missing");
  process.exit(1);
}

const config = normalize({
  apiKey: decodeURIComponent(match[1]),
  apiSecret: decodeURIComponent(match[2]),
  cloudName: match[3],
});

cloudinary.config({
  cloud_name: config.cloudName,
  api_key: config.apiKey,
  api_secret: config.apiSecret,
  secure: true,
});

await cloudinary.api.ping();
console.log("ping: ok");

const buffer = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const dataUri = `data:image/png;base64,${buffer.toString("base64")}`;
const result = await cloudinary.uploader.upload(dataUri, {
  folder: "leptonpad/test",
  resource_type: "image",
});
console.log("upload:", result.secure_url);
