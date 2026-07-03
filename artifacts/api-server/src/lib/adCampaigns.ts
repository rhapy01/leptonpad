import { and, eq, lt, sql } from "drizzle-orm";
import { db, adCampaignsTable } from "@workspace/db";

export const AD_DURATION_DAYS = [7, 14, 30] as const;
export type AdDurationDays = (typeof AD_DURATION_DAYS)[number];

export const AD_BANNER_REQUIREMENTS = {
  headline: "Short headline shown on the banner (optional — defaults to your business name).",
  businessName: "Your company or brand name (shown under the headline).",
  targetUrl: "HTTPS link where readers go when they click “Learn more”.",
  image: {
    formats: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    formatLabels: "JPG, PNG, WebP, or GIF",
    maxBytes: 2 * 1024 * 1024,
    maxBytesLabel: "2 MB",
    recommendedWidth: 400,
    recommendedHeight: 200,
    aspectRatio: "2:1 landscape",
  },
  durations: AD_DURATION_DAYS.map((days) => ({
    days,
    label: days === 7 ? "1 week" : days === 14 ? "2 weeks" : "1 month",
  })),
  review: "All submissions are reviewed by our team before going live in the feed.",
};

export function durationLabel(days: number): string {
  const match = AD_BANNER_REQUIREMENTS.durations.find((d) => d.days === days);
  return match?.label ?? `${days} days`;
}

export function computeExpiresAt(durationDays: number, from = new Date()): Date {
  const expires = new Date(from);
  expires.setUTCDate(expires.getUTCDate() + durationDays);
  return expires;
}

export function parseDurationDays(raw: unknown): AdDurationDays | null {
  const days = typeof raw === "string" ? Number.parseInt(raw, 10) : Number(raw);
  if (!AD_DURATION_DAYS.includes(days as AdDurationDays)) return null;
  return days as AdDurationDays;
}

export function isAdLive(ad: {
  active: boolean;
  expiresAt: Date | null;
}, now = new Date()): boolean {
  if (!ad.active) return false;
  if (ad.expiresAt && ad.expiresAt <= now) return false;
  return true;
}

/** Deactivate campaigns past their expiry so they stop appearing in the feed. */
export async function deactivateExpiredAds(now = new Date()): Promise<number> {
  const expired = await db
    .update(adCampaignsTable)
    .set({ active: false })
    .where(
      and(
        eq(adCampaignsTable.active, true),
        sql`${adCampaignsTable.expiresAt} is not null`,
        lt(adCampaignsTable.expiresAt, now),
      ),
    )
    .returning({ id: adCampaignsTable.id });
  return expired.length;
}

export async function fetchLiveFeedAds(category?: string) {
  await deactivateExpiredAds();
  const now = new Date();

  const rows = await db
    .select()
    .from(adCampaignsTable)
    .where(
      and(
        eq(adCampaignsTable.active, true),
        sql`(${adCampaignsTable.expiresAt} is null or ${adCampaignsTable.expiresAt} > ${now})`,
      ),
    )
    .orderBy(sql`random()`)
    .limit(3);

  return category
    ? rows.filter((r) => !r.categorySlug || r.categorySlug === category)
    : rows;
}
