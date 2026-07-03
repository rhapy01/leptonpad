/** Lightweight API helpers for dashboard pages (avoids full OpenAPI regen). */

import { apiFetch } from "./apiFetch";

async function apiGet<T>(path: string): Promise<T> {
  const res = await apiFetch(`/api${path}`);
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(`/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `API ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function apiDelete<T>(path: string, body?: unknown): Promise<T> {
  const res = await apiFetch(`/api${path}`, {
    method: "DELETE",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `API ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(`/api${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `API ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export type FeaturedContent = {
  id: number;
  title: string;
  type: string;
  categoryName: string;
  categorySlug: string;
  price: number;
  creatorName: string;
  creatorImageUrl: string | null;
  creatorVerified: boolean;
  previewText: string | null;
  coverImageUrl: string | null;
  purchaseCount: number;
  featured: boolean;
  createdAt: string;
};

export type FeaturedByType = {
  article: FeaturedContent | null;
  video: FeaturedContent | null;
  audio: FeaturedContent | null;
};

export function fetchFeaturedContent() {
  return apiGet<FeaturedByType>("/content/featured");
}

export type FollowingItem = {
  id: number;
  title: string;
  type: string;
  categorySlug: string;
  previewText: string | null;
  coverImageUrl: string | null;
  price: number;
  creatorId: string;
  creatorName: string;
  creatorImageUrl: string | null;
  creatorVerified: boolean;
  featured: boolean;
  createdAt: string;
};

export function fetchFollowingFeed() {
  return apiGet<{ items: FollowingItem[]; categories: string[]; followedCreators: string[] }>("/dashboard/following");
}

export type ReaderSummary = {
  name: string;
  selectedCategories: string[];
  totalSpent: number;
  purchaseCount: number;
};

export function fetchReaderSummary() {
  return apiGet<ReaderSummary>("/dashboard/reader");
}

export type AdminOverview = {
  totalUsdcPaid: number;
  totalPayments: number;
  totalContent: number;
  featuredCount: number;
  totalUsers: number;
  verifiedCreators: number;
  pendingAdSubmissions?: number;
  emailConfigured?: boolean;
};

export type AdminUser = {
  id: number;
  clerkId: string;
  name: string;
  email: string;
  verified: boolean;
  isAdmin: boolean;
  onboardingComplete: boolean;
  createdAt: string;
};

export function fetchAdminOverview() {
  return apiGet<AdminOverview>("/admin/overview");
}

export function fetchAdminUsers() {
  return apiGet<AdminUser[]>("/admin/users");
}

export function setContentFeatured(id: number, featured: boolean) {
  return apiPatch<{ id: number; title: string; featured: boolean }>(`/admin/content/${id}/featured`, { featured });
}

export function setUserVerified(clerkId: string, verified: boolean) {
  return apiPatch<{
    clerkId: string;
    name: string;
    verified: boolean;
    onChainSync?: {
      newlyRegistered: number[];
      failed: Array<{ contentId: number; reason: string }>;
    };
  }>(`/admin/users/${clerkId}/verified`, { verified });
}

export function deleteAdminContent(id: number, reason?: string) {
  return apiDelete<{ id: number; title: string; deleted: boolean }>(`/admin/content/${id}`, { reason });
}

export function previewNewsletter(subject: string, body: string) {
  return apiPost<{ preview: boolean; recipientCount: number; subject: string }>("/admin/newsletter", {
    subject,
    body,
    preview: true,
  });
}

export function sendNewsletter(subject: string, body: string) {
  return apiPost<{ sent: number; subject: string; batchId: string }>("/admin/newsletter", { subject, body });
}

export type AdminAdCampaign = {
  id: number;
  title: string;
  advertiser: string;
  imageUrl: string | null;
  targetUrl: string;
  categorySlug: string | null;
  active: boolean;
  expiresAt: string | null;
  submissionId: number | null;
  impressionCount: number;
  clickCount: number;
  createdAt: string;
};

export type AdminAdCampaignInput = {
  title: string;
  advertiser: string;
  targetUrl: string;
  imageUrl?: string | null;
  categorySlug?: string | null;
  active?: boolean;
  durationDays?: number;
};

export type AdminAdSubmission = {
  id: number;
  contactName: string | null;
  contactEmail: string;
  businessName: string;
  headline: string;
  targetUrl: string;
  imageUrl: string;
  durationDays: number;
  durationLabel: string;
  categorySlug: string | null;
  status: string;
  adminNote: string | null;
  campaignId: number | null;
  submitterUserId: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

export function fetchAdminAds() {
  return apiGet<AdminAdCampaign[]>("/admin/ads");
}

export function createAdminAd(body: AdminAdCampaignInput) {
  return apiPost<AdminAdCampaign>("/admin/ads", body);
}

export function updateAdminAd(id: number, body: Partial<AdminAdCampaignInput>) {
  return apiPatch<AdminAdCampaign>(`/admin/ads/${id}`, body);
}

export function deleteAdminAd(id: number) {
  return apiDelete<{ id: number; title: string; deleted: boolean }>(`/admin/ads/${id}`);
}

export function fetchAdminAdSubmissions(status?: string) {
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiGet<AdminAdSubmission[]>(`/admin/ad-submissions${q}`);
}

export function reviewAdminAdSubmission(
  id: number,
  status: "approved" | "rejected",
  adminNote?: string,
) {
  return apiPatch<{
    submission?: AdminAdSubmission;
    campaign?: AdminAdCampaign;
  }>(`/admin/ad-submissions/${id}`, { status, adminNote });
}
