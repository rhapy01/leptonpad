import { createHash } from "node:crypto";
import { extname } from "node:path";
import { randomUUID } from "node:crypto";
import { logger } from "./logger";
import { envValue } from "./blobStorage";

export type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

/** Parse `cloudinary://api_key:api_secret@cloud_name` (Heroku / dashboard format). */
export function parseCloudinaryUrl(raw: string): CloudinaryConfig | null {
  const trimmed = raw.trim().replace(/^["']|["']$/g, "");
  const match = trimmed.match(/^cloudinary:\/\/([^:]+):([^@]+)@([^/?#]+)/);
  if (!match) return null;
  return {
    apiKey: decodeURIComponent(match[1]),
    apiSecret: decodeURIComponent(match[2]),
    cloudName: match[3],
  };
}

export function getCloudinaryConfig(): CloudinaryConfig | null {
  const fromUrl = envValue("CLOUDINARY_URL");
  if (fromUrl) {
    const parsed = parseCloudinaryUrl(fromUrl);
    if (parsed) return parsed;
  }

  const cloudName = envValue("CLOUDINARY_CLOUD_NAME");
  const apiKey = envValue("CLOUDINARY_API_KEY");
  const apiSecret = envValue("CLOUDINARY_API_SECRET");
  if (cloudName && apiKey && apiSecret) {
    return { cloudName, apiKey, apiSecret };
  }

  return null;
}

export function cloudinaryEnabled(): boolean {
  return getCloudinaryConfig() !== null;
}

export async function uploadToCloudinary(input: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  userId: string;
}): Promise<{ url: string; storedKey: string }> {
  const config = getCloudinaryConfig();
  if (!config) throw new Error("Cloudinary is not configured");

  const { cloudName, apiKey, apiSecret } = config;
  const ext = extname(input.filename) || `.${input.mimeType.split("/")[1] ?? "bin"}`;
  const publicId = `${randomUUID()}${ext}`;
  const folder = `leptonpad/${input.userId}`;
  const timestamp = Math.round(Date.now() / 1000);

  const signature = createHash("sha1")
    .update(`folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
    .digest("hex");

  const form = new FormData();
  form.append("file", new Blob([input.buffer], { type: input.mimeType }), input.filename);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);
  form.append("folder", folder);
  form.append("public_id", publicId);

  const resourceType = input.mimeType.startsWith("video/")
    ? "video"
    : input.mimeType.startsWith("audio/")
      ? "video"
      : "image";

  const endpoint =
    resourceType === "image"
      ? `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`
      : `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`;

  const res = await fetch(endpoint, { method: "POST", body: form });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Cloudinary upload failed (${res.status}): ${detail || res.statusText}`);
  }

  const body = (await res.json()) as { secure_url: string; public_id: string };
  logger.info({ publicId: body.public_id, bytes: input.buffer.length }, "Stored upload in Cloudinary");
  return { url: body.secure_url, storedKey: body.public_id };
}
