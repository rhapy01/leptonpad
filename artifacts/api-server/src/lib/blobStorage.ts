import { mkdir, writeFile } from "node:fs/promises";

import { join, extname } from "node:path";

import { randomUUID } from "node:crypto";

import { logger } from "./logger";

import { cloudinaryEnabled, uploadToCloudinary } from "./cloudinaryStorage";



export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), "uploads");



const BLOB_API_URL = "https://vercel.com/api/blob";

const BLOB_API_VERSION = "12";



type UploadProvider = "blob" | "cloudinary" | "local";



/** Strip optional quotes from .env values (e.g. BLOB_READ_WRITE_TOKEN="..."). */

export function envValue(key: string): string | undefined {

  const raw = process.env[key]?.trim();

  if (!raw) return undefined;

  return raw.replace(/^["']|["']$/g, "");

}



export function getBlobToken(): string | undefined {

  return envValue("BLOB_READ_WRITE_TOKEN");

}



function parseStoreIdFromToken(token: string): string {

  const parts = token.split("_");

  return parts[3] ?? "";

}



export function getBlobStoreId(): string | undefined {

  const fromEnv = envValue("BLOB_STORE_ID");

  if (fromEnv) {

    return fromEnv.startsWith("store_") ? fromEnv.slice("store_".length) : fromEnv;

  }

  const token = getBlobToken();

  return token ? parseStoreIdFromToken(token) : undefined;

}



export function blobStorageEnabled(): boolean {

  return !!getBlobToken() && !!getBlobStoreId();

}



const ALLOWED_CONTENT_TYPES = [

  "image/jpeg", "image/png", "image/webp", "image/gif",

  "audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/webm",

  "video/mp4", "video/webm", "video/quicktime",

  "application/pdf",

] as const;



export function isAllowedMimeType(mimeType: string): boolean {

  return (ALLOWED_CONTENT_TYPES as readonly string[]).includes(mimeType);

}



interface BlobPutResponse {

  url: string;

  pathname: string;

}



function resolveUploadProviders(): UploadProvider[] {

  const explicit = envValue("UPLOAD_PROVIDER");

  if (explicit === "blob" || explicit === "cloudinary" || explicit === "local") {

    return [explicit];

  }



  const order: UploadProvider[] = [];

  if (cloudinaryEnabled()) order.push("cloudinary");

  if (blobStorageEnabled()) order.push("blob");

  order.push("local");

  return order;

}



function localUploadDir(): string {

  if (process.env.VERCEL) return join("/tmp", "leptonpad-uploads");

  return UPLOAD_DIR;

}



async function putToVercelBlob(input: {

  pathname: string;

  buffer: Buffer;

  mimeType: string;

  token: string;

  storeId: string;

}): Promise<BlobPutResponse> {

  const params = new URLSearchParams({ pathname: input.pathname });

  const res = await fetch(`${BLOB_API_URL}/?${params.toString()}`, {

    method: "PUT",

    headers: {

      authorization: `Bearer ${input.token}`,

      "x-api-version": BLOB_API_VERSION,

      "x-vercel-blob-store-id": input.storeId,

      "x-content-length": String(input.buffer.length),

      "x-vercel-blob-access": "public",

      "x-add-random-suffix": "0",

      "x-content-type": input.mimeType,

    },

    body: input.buffer,

  });



  if (!res.ok) {

    const detail = await res.text().catch(() => "");

    throw new Error(`Vercel Blob upload failed (${res.status}): ${detail || res.statusText}`);

  }



  return res.json() as Promise<BlobPutResponse>;

}



async function storeInBlob(

  input: { buffer: Buffer; mimeType: string; userId: string },

  storedKey: string,

): Promise<{ url: string; storedKey: string; provider: "blob" }> {

  const token = getBlobToken();

  const storeId = getBlobStoreId();

  if (!token || !storeId) throw new Error("Vercel Blob is not configured");



  const pathname = `leptonpad/${input.userId}/${storedKey}`;

  const result = await putToVercelBlob({

    pathname,

    buffer: input.buffer,

    mimeType: input.mimeType,

    token,

    storeId,

  });

  logger.info({ storeId, pathname, bytes: input.buffer.length }, "Stored upload in Vercel Blob");

  return { url: result.url, storedKey: result.pathname, provider: "blob" };

}



async function storeOnLocalDisk(

  input: { buffer: Buffer },

  storedKey: string,

): Promise<{ url: string; storedKey: string; provider: "local" }> {

  const dir = localUploadDir();

  await mkdir(dir, { recursive: true });

  const filepath = join(dir, storedKey);

  await writeFile(filepath, input.buffer);



  const baseUrl = process.env.PUBLIC_URL ?? "";

  const url = baseUrl ? `${baseUrl}/api/uploads/files/${storedKey}` : `/api/uploads/files/${storedKey}`;

  return { url, storedKey, provider: "local" };

}



export async function storeUploadedFile(input: {

  buffer: Buffer;

  filename: string;

  mimeType: string;

  userId: string;

}): Promise<{ url: string; storedKey: string; provider: UploadProvider }> {

  const ext = extname(input.filename) || `.${input.mimeType.split("/")[1] ?? "bin"}`;

  const storedKey = `${randomUUID()}${ext}`;



  let lastError: Error | undefined;

  for (const provider of resolveUploadProviders()) {

    try {

      switch (provider) {

        case "blob":

          return await storeInBlob(input, storedKey);

        case "cloudinary": {

          const result = await uploadToCloudinary(input);

          return { ...result, provider: "cloudinary" };

        }

        case "local":

          return await storeOnLocalDisk(input, storedKey);

        default:

          break;

      }

    } catch (err) {

      lastError = err instanceof Error ? err : new Error(String(err));

      logger.warn({ err: lastError, provider }, "Upload provider failed, trying next");

    }

  }



  throw lastError ?? new Error("No upload storage provider is configured");

}


