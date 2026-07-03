import { randomUUID } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import { logger } from "./logger";
import { envValue } from "./blobStorage";

export type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

/** Cloudinary API keys are numeric; secrets are alphanumeric. Fix common swap in CLOUDINARY_URL. */
export function normalizeCloudinaryCredentials(config: CloudinaryConfig): CloudinaryConfig {
  const keyIsNumeric = /^\d{8,}$/.test(config.apiKey);
  const secretIsNumeric = /^\d{8,}$/.test(config.apiSecret);
  const keyHasLetters = /[a-zA-Z]/.test(config.apiKey);

  if (keyHasLetters && secretIsNumeric) {
    logger.warn("CLOUDINARY_URL had api_key and api_secret reversed — auto-corrected");
    return {
      cloudName: config.cloudName,
      apiKey: config.apiSecret,
      apiSecret: config.apiKey,
    };
  }

  if (!keyIsNumeric && !secretIsNumeric && keyHasLetters) {
    return config;
  }

  return config;
}

/** Parse `cloudinary://api_key:api_secret@cloud_name` (Heroku / dashboard format). */
export function parseCloudinaryUrl(raw: string): CloudinaryConfig | null {
  const trimmed = raw.trim().replace(/^["']|["']$/g, "");
  const match = trimmed.match(/^cloudinary:\/\/([^:]+):([^@]+)@([^/?#]+)/);
  if (!match) return null;
  return normalizeCloudinaryCredentials({
    apiKey: decodeURIComponent(match[1]),
    apiSecret: decodeURIComponent(match[2]),
    cloudName: decodeURIComponent(match[3]),
  });
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
    return normalizeCloudinaryCredentials({ cloudName, apiKey, apiSecret });
  }

  return null;
}

let configured = false;

export function applyCloudinaryConfig(): CloudinaryConfig | null {
  const config = getCloudinaryConfig();
  if (!config) return null;

  cloudinary.config({
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    secure: true,
  });
  configured = true;
  return config;
}

export function cloudinaryEnabled(): boolean {
  return getCloudinaryConfig() !== null;
}

function resourceTypeForMime(mimeType: string): "image" | "video" | "raw" | "auto" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/") || mimeType.startsWith("audio/")) return "video";
  if (mimeType === "application/pdf") return "raw";
  return "auto";
}

export async function uploadToCloudinary(input: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  userId: string;
}): Promise<{ url: string; storedKey: string }> {
  const config = applyCloudinaryConfig();
  if (!config) throw new Error("Cloudinary is not configured");

  if (!configured) {
    throw new Error("Cloudinary SDK failed to initialize");
  }

  const folder = `leptonpad/${input.userId}`;
  const publicId = randomUUID();
  const resourceType = resourceTypeForMime(input.mimeType);
  const dataUri = `data:${input.mimeType};base64,${input.buffer.toString("base64")}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    public_id: publicId,
    resource_type: resourceType,
    overwrite: false,
    unique_filename: false,
    use_filename: false,
  });

  logger.info(
    { publicId: result.public_id, bytes: input.buffer.length, resourceType },
    "Stored upload in Cloudinary",
  );

  return { url: result.secure_url, storedKey: result.public_id };
}

export async function pingCloudinary(): Promise<boolean> {
  const config = applyCloudinaryConfig();
  if (!config) return false;
  try {
    await cloudinary.api.ping();
    return true;
  } catch (err) {
    logger.warn({ err }, "Cloudinary ping failed");
    return false;
  }
}
