import { Router } from "express";
import { getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, mediaUploadsTable } from "@workspace/db";
import {
  blobStorageEnabled,
  getBlobStoreId,
  isAllowedMimeType,
  storeUploadedFile,
  UPLOAD_DIR,
} from "../lib/blobStorage";
import { cloudinaryEnabled } from "../lib/cloudinaryStorage";

const router = Router();

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_MEDIA_BYTES = 50 * 1024 * 1024;

function maxBytesForMime(mimeType: string): number {
  return mimeType.startsWith("video/") || mimeType.startsWith("audio/")
    ? MAX_MEDIA_BYTES
    : MAX_IMAGE_BYTES;
}

// GET /api/uploads/config — tells the UI which storage backend is active
router.get("/config", (_req, res): void => {
  res.json({
    provider: cloudinaryEnabled() ? "cloudinary" : blobStorageEnabled() ? "blob" : "local",
    storeId: getBlobStoreId() ?? null,
    maxImageBytes: MAX_IMAGE_BYTES,
    maxMediaBytes: MAX_MEDIA_BYTES,
  });
});

router.post("/", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { filename, data, mimeType } = req.body as {
    filename?: string; data?: string; mimeType?: string;
  };

  if (!filename || !data || !mimeType) {
    res.status(400).json({ error: "filename, data (base64), and mimeType required" });
    return;
  }

  if (!isAllowedMimeType(mimeType)) {
    res.status(400).json({ error: `MIME type not allowed: ${mimeType}` });
    return;
  }

  const buffer = Buffer.from(data, "base64");
  const maxBytes = maxBytesForMime(mimeType);
  if (buffer.length > maxBytes) {
    res.status(400).json({ error: `File too large (max ${Math.round(maxBytes / 1024 / 1024)}MB)` });
    return;
  }

  const stored = await storeUploadedFile({
    buffer,
    filename,
    mimeType,
    userId,
  });

  const [row] = await db.insert(mediaUploadsTable).values({
    userId,
    filename: stored.storedKey,
    originalName: filename,
    mimeType,
    sizeBytes: buffer.length,
    url: stored.url,
  }).returning();

  res.status(201).json({
    id: row.id,
    url: row.url,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    originalName: row.originalName,
    provider: stored.provider,
  });
});

router.get("/mine", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rows = await db.select().from(mediaUploadsTable)
    .where(eq(mediaUploadsTable.userId, userId))
    .orderBy(mediaUploadsTable.createdAt);

  res.json(rows.map(r => ({
    id: r.id,
    url: r.url,
    mimeType: r.mimeType,
    originalName: r.originalName,
    createdAt: r.createdAt.toISOString(),
  })));
});

export { UPLOAD_DIR };
export default router;
