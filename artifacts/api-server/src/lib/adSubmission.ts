import { storeUploadedFile } from "./blobStorage";
import { validateOptionalUrl } from "./validateUrl";
import {
  AD_BANNER_REQUIREMENTS,
  parseDurationDays,
  type AdDurationDays,
} from "./adCampaigns";

export type AdSubmissionInput = {
  contactName?: string;
  contactEmail: string;
  businessName: string;
  headline?: string;
  targetUrl: string;
  durationDays: AdDurationDays;
  categorySlug?: string | null;
  imageUrl?: string;
  imageData?: string;
  imageFilename?: string;
  imageMimeType?: string;
};

export function parseAdSubmissionBody(
  body: Record<string, unknown>,
): { ok: true; data: AdSubmissionInput } | { ok: false; error: string } {
  const contactEmail = typeof body.contactEmail === "string" ? body.contactEmail.trim().toLowerCase() : "";
  if (!contactEmail || !contactEmail.includes("@")) {
    return { ok: false, error: "A valid contact email is required" };
  }

  const businessName = typeof body.businessName === "string" ? body.businessName.trim() : "";
  if (!businessName) return { ok: false, error: "Business name is required" };
  if (businessName.length > 80) return { ok: false, error: "Business name must be 80 characters or fewer" };

  const headlineRaw = typeof body.headline === "string" ? body.headline.trim() : "";
  const headline = headlineRaw || businessName;
  if (headline.length > 120) return { ok: false, error: "Headline must be 120 characters or fewer" };

  const targetUrlRaw = typeof body.targetUrl === "string" ? body.targetUrl.trim() : "";
  if (!targetUrlRaw) return { ok: false, error: "Website link is required" };
  let targetUrl: string;
  try {
    targetUrl = validateOptionalUrl(targetUrlRaw, "targetUrl") ?? "";
    if (!targetUrl) return { ok: false, error: "Invalid website link — use http:// or https://" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Invalid website link" };
  }

  const durationDays = parseDurationDays(body.durationDays);
  if (!durationDays) {
    return { ok: false, error: "Choose a valid duration (1 week, 2 weeks, or 1 month)" };
  }

  const contactName =
    typeof body.contactName === "string" && body.contactName.trim()
      ? body.contactName.trim().slice(0, 80)
      : undefined;

  const categorySlug =
    typeof body.categorySlug === "string" && body.categorySlug.trim()
      ? body.categorySlug.trim().toLowerCase()
      : null;

  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
  const imageData = typeof body.imageData === "string" ? body.imageData : "";
  const imageFilename = typeof body.imageFilename === "string" ? body.imageFilename.trim() : "";
  const imageMimeType = typeof body.imageMimeType === "string" ? body.imageMimeType.trim() : "";

  if (!imageUrl && !imageData) {
    return { ok: false, error: "Banner image or GIF is required" };
  }

  return {
    ok: true,
    data: {
      contactName,
      contactEmail,
      businessName,
      headline,
      targetUrl,
      durationDays,
      categorySlug,
      imageUrl: imageUrl || undefined,
      imageData: imageData || undefined,
      imageFilename: imageFilename || undefined,
      imageMimeType: imageMimeType || undefined,
    },
  };
}

export async function resolveAdBannerImageUrl(
  input: AdSubmissionInput,
  userId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (input.imageUrl) {
    try {
      const safe = validateOptionalUrl(input.imageUrl, "imageUrl");
      if (!safe) return { ok: false, error: "Invalid banner image URL" };
      return { ok: true, url: safe };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Invalid banner image URL" };
    }
  }

  if (!input.imageData || !input.imageFilename || !input.imageMimeType) {
    return { ok: false, error: "Banner file data, filename, and type are required" };
  }

  if (!AD_BANNER_REQUIREMENTS.image.formats.includes(input.imageMimeType)) {
    return {
      ok: false,
      error: `Banner must be ${AD_BANNER_REQUIREMENTS.image.formatLabels}`,
    };
  }

  const buffer = Buffer.from(input.imageData, "base64");
  if (buffer.length > AD_BANNER_REQUIREMENTS.image.maxBytes) {
    return {
      ok: false,
      error: `Banner must be ${AD_BANNER_REQUIREMENTS.image.maxBytesLabel} or smaller`,
    };
  }

  const stored = await storeUploadedFile({
    buffer,
    filename: input.imageFilename,
    mimeType: input.imageMimeType,
    userId,
  });

  return { ok: true, url: stored.url };
}
