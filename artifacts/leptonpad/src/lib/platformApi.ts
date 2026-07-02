/** Platform API helpers for social, discovery, creators, SEO, and intelligence features. */

import { apiFetch } from "./apiFetch";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(`/api${path}`, init);
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `API ${path} failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Creators ────────────────────────────────────────────────────────────────

export type CreatorProfile = {
  clerkId: string;
  name: string;
  imageUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  website: string | null;
  twitterUrl: string | null;
  linkedinUrl: string | null;
  country: string | null;
  language: string | null;
  verified: boolean;
  followerCount: number;
  subscriberCount: number;
  followingCount: number;
  contentCount: number;
  isFollowing: boolean;
  isSubscribed: boolean;
  joinDate: string;
  works: Array<{
    id: number;
    title: string;
    type: string;
    categorySlug: string;
    coverImageUrl: string | null;
    previewText: string | null;
    price: number;
    viewCount: number;
    purchaseCount: number;
    tags: string[];
    slug: string | null;
    createdAt: string;
  }>;
};

export type RisingCreator = {
  clerkId: string;
  name: string;
  imageUrl: string | null;
  verified: boolean;
  totalViews: number;
  totalPurchases: number;
  pieceCount: number;
  followerCount: number;
};

export function fetchCreatorProfile(clerkId: string) {
  return api<CreatorProfile>(`/creators/${clerkId}`);
}

export function fetchRisingCreators() {
  return api<RisingCreator[]>("/creators");
}

export function followCreator(creatorId: string) {
  return api<{ following: boolean; subscribed: boolean }>(`/social/follow/${creatorId}`, { method: "POST" });
}

export function unfollowCreator(creatorId: string) {
  return api<{ following: boolean; subscribed: boolean }>(`/social/follow/${creatorId}`, { method: "DELETE" });
}

export function fetchFollowStatus(creatorId: string) {
  return api<{
    following: boolean;
    subscribed: boolean;
    followerCount: number;
    subscriberCount: number;
  }>(`/social/follow/${creatorId}/status`);
}

export function broadcastToSubscribers(contentId?: number) {
  return api<{
    ok: boolean;
    contentId: number;
    title: string;
    emailed: number;
    subscriberCount: number;
  }>("/creators/me/broadcast", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(contentId != null ? { contentId } : {}),
  });
}

// ─── Social ──────────────────────────────────────────────────────────────────

export type Comment = {
  id: number;
  contentId: number;
  userId: string;
  userName: string;
  userImageUrl: string | null;
  userVerified: boolean;
  body: string;
  parentId: number | null;
  createdAt: string;
};

export function fetchComments(contentId: number) {
  return api<Comment[]>(`/social/content/${contentId}/comments`);
}

export function postComment(contentId: number, body: string, parentId?: number) {
  return api<Comment>(`/social/content/${contentId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body, parentId }),
  });
}

export function fetchReactions(contentId: number) {
  return api<{ count: number; userReacted: boolean }>(`/social/content/${contentId}/reactions`);
}

export function toggleReaction(contentId: number) {
  return api<{ reacted: boolean; count: number }>(`/social/content/${contentId}/react`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "clap" }),
  });
}

export type Collection = {
  id: number;
  name: string;
  slug: string;
  isDefault: boolean;
  itemCount: number;
  createdAt?: string;
};

export function fetchCollections() {
  return api<Collection[]>("/social/collections");
}

export function createCollection(name: string) {
  return api<Collection>("/social/collections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export function saveToCollection(collectionId: number, contentId: number) {
  return api<{ saved: boolean }>(`/social/collections/${collectionId}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentId }),
  });
}

export type CollectionItem = {
  id: number;
  title: string;
  type: string;
  categorySlug: string;
  coverImageUrl: string | null;
  price: number;
  creatorId: string;
  addedAt?: string;
};

export function fetchCollectionItems(collectionId: number) {
  return api<CollectionItem[]>(`/social/collections/${collectionId}/items`);
}

export function removeFromCollection(collectionId: number, contentId: number) {
  return api<{ saved: boolean }>(`/social/collections/${collectionId}/items/${contentId}`, {
    method: "DELETE",
  });
}

export function reportContent(contentId: number, reason: string) {
  return api<{ reported: boolean }>(`/social/content/${contentId}/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
}

export type Notification = {
  id: number;
  type: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

export function fetchNotifications() {
  return api<Notification[]>("/social/notifications");
}

export function markAllNotificationsRead() {
  return api<{ ok: boolean }>("/social/notifications/read-all", { method: "POST" });
}

export function saveReadingProgress(contentId: number, data: { progressPct: number; scrollPosition: number; completed?: boolean }) {
  return api<{ ok: boolean }>(`/social/reading-progress/${contentId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function fetchReadingProgress(contentId: number) {
  return api<{ progressPct: number; scrollPosition: number; completed: boolean }>(`/social/reading-progress/${contentId}`);
}

export function fetchDrafts() {
  return api<unknown[]>("/content/mine/drafts");
}

export function fetchContentVersions(contentId: number) {
  return api<Array<{ id: number; title: string; createdAt: string }>>(`/social/content/${contentId}/versions`);
}

// ─── Discovery ───────────────────────────────────────────────────────────────

export type DiscoveryItem = {
  id: number;
  title: string;
  type: string;
  categorySlug: string;
  categoryName?: string;
  coverImageUrl: string | null;
  previewText?: string | null;
  price: number;
  creatorId: string;
  creatorName?: string;
  creatorImageUrl?: string | null;
  creatorVerified?: boolean;
  viewCount?: number;
  purchaseCount?: number;
  bookmarkCount?: number;
  reactionCount?: number;
  tags?: string[];
  country?: string | null;
  createdAt: string;
};

export function fetchTrending(period: "today" | "week" | "all" = "week") {
  return api<DiscoveryItem[]>(`/discovery/trending?period=${period}`);
}

export function fetchMostBookmarked() {
  return api<DiscoveryItem[]>("/discovery/most-bookmarked");
}

export function fetchPersonalizedFeed() {
  return api<{ items: DiscoveryItem[]; reason: string }>("/discovery/personalized");
}

export function fetchByCountry(country: string) {
  return api<DiscoveryItem[]>(`/discovery/by-country/${encodeURIComponent(country)}`);
}

export function fetchByTag(tag: string) {
  return api<DiscoveryItem[]>(`/discovery/tags/${encodeURIComponent(tag)}`);
}

// ─── Intelligence ────────────────────────────────────────────────────────────

export type IntelligenceOverview = {
  summary: {
    totalPieces: number;
    totalViews: number;
    totalPurchases: number;
    avgConversionRate: string;
  };
  risingTags: Array<{ tag: string; count: number; purchases: number; views: number; score: number }>;
  underservedTags: Array<{ tag: string; count: number; purchases: number; views: number; score: number }>;
  categoryStats: Record<string, { pieces: number; views: number; purchases: number; revenue: number }>;
  topContent: Array<{ id: number; title: string; conversionRate: string; revenue: string; views: number }>;
  topCountries: Array<{ country: string; score: number }>;
  bestPublishHours: Array<{ hour: number; count: number; purchases: number }>;
  contentGaps: Array<{ category: string; demand: number; yourPieces: number }>;
  recommendations: Array<{ type: string; title: string; reason: string; priority: string }>;
};

export function fetchIntelligence() {
  return api<IntelligenceOverview>("/intelligence/overview");
}

export function exportContent() {
  return api<unknown>("/intelligence/export");
}

// ─── SEO ─────────────────────────────────────────────────────────────────────

export function fetchContentMeta(contentId: number) {
  return api<{
    title: string;
    description: string;
    canonicalUrl: string;
    og: Record<string, string | null | undefined>;
    twitter: Record<string, string | null | undefined>;
  }>(`/seo/content/${contentId}/meta`);
}

// ─── Extended content create/update ──────────────────────────────────────────

export async function createContentExtended(data: Record<string, unknown>) {
  return api<unknown>("/content", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateContentExtended(id: number, data: Record<string, unknown>) {
  return api<unknown>(`/content/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateProfileExtended(data: Record<string, unknown>) {
  return api<unknown>("/users/me", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

// ─── LLM AI ──────────────────────────────────────────────────────────────────

export function aiSuggestTitles(body: string, category?: string) {
  return api<{ titles: string[]; llm: boolean }>("/ai/llm/titles", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body, category }),
  });
}

export function aiOptimizeSeo(title: string, body: string, tags?: string[]) {
  return api<{ metaDescription: string; keywords: string[]; slugSuggestion: string; llm: boolean }>("/ai/llm/seo", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, body, tags }),
  });
}

export function aiImproveText(text: string, mode: "grammar" | "expand" | "summarize") {
  return api<{ text: string; llm: boolean }>("/ai/llm/improve", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, mode }),
  });
}

export function aiSuggestTags(title: string, body: string) {
  return api<{ tags: string[]; llm: boolean }>("/ai/llm/tags", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, body }),
  });
}

// ─── Monetization (ads) ──────────────────────────────────────────────────────

export type AdCampaign = { id: number; title: string; advertiser: string; imageUrl: string | null; targetUrl: string };

export function fetchFeedAds(category?: string) {
  const q = category ? `?category=${encodeURIComponent(category)}` : "";
  return api<AdCampaign[]>(`/monetization/ads/feed${q}`);
}

export function trackAdImpression(id: number, clicked = false) {
  return api<{ ok: boolean }>(`/monetization/ads/${id}/impression`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clicked }),
  });
}

// ─── Uploads ─────────────────────────────────────────────────────────────────

export async function uploadMedia(file: File): Promise<{ url: string; mimeType: string }> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
  return api("/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, data: base64, mimeType: file.type || "application/octet-stream" }),
  });
}

// ─── Gamification ────────────────────────────────────────────────────────────

export function recordRead() {
  return api<{ currentStreak: number; xp: number; writerLevel: number }>("/gamification/read", { method: "POST" });
}

export function fetchGamification() {
  return api<{
    streak: { currentStreak: number; longestStreak: number; totalReads: number; xp: number; writerLevel: number };
    badges: Array<{ slug: string; name: string; description: string; icon: string; earnedAt: string }>;
    allBadges: Array<{ slug: string; name: string; description: string; icon: string; earned: boolean }>;
  }>("/gamification/me");
}

// ─── Competitions ────────────────────────────────────────────────────────────

export type Competition = {
  id: number; title: string; slug: string; description: string; theme: string;
  region: string | null; language: string | null; prizeDescription: string | null;
  deadline: string; status: string; coverImageUrl: string | null;
};

export function fetchCompetitions() {
  return api<Competition[]>("/awas/competitions");
}

export function fetchCompetition(slug: string) {
  return api<Competition & { entries: Array<{ id: number; title: string; excerpt: string | null; status: string }> }>(`/awas/competitions/${slug}`);
}

export function enterCompetition(id: number, data: { title: string; excerpt?: string; contentId?: number }) {
  return api("/awas/competitions/" + id + "/enter", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  });
}

export function fetchRightsList(type?: string) {
  const q = type ? `?type=${type}` : "";
  return api<Array<{ id: number; contentId: number; contentTitle: string; rightsType: string; territory: string | null; status: string }>>(`/awas/rights${q}`);
}

export function listContentRights(data: { contentId: number; rightsType: string; territory?: string; licenseTerms?: string }) {
  return api("/awas/rights", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
}

export function inquireRights(id: number, message: string) {
  return api(`/awas/rights/${id}/inquire`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
}

// ─── Settlement (Arc / x402 / LeptonSplit) ───────────────────────────────────

export type SettlementRail = {
  enabled: boolean;
  mockMode: boolean;
  chainId: number;
  chainName: string;
  network: string;
  splitContract: string | null;
  explorerBase: string;
  flow: string[];
  creatorShareBps: number;
};

export type CreatorSettlementStats = SettlementRail & {
  salesSettledOnChain: number;
  salesPendingSplit: number;
  totalSales: number;
};

export type PurchaseWithSettlement = {
  id: number;
  contentId: number;
  contentTitle: string;
  contentType: string;
  creatorName: string;
  creatorVerified: boolean;
  amountPaid: number;
  paidAt: string;
  txHash?: string | null;
  splitTxHash?: string | null;
  settlementStatus?: "settled" | "pending" | "recorded";
};

export function fetchSettlementRail() {
  return api<SettlementRail>("/payments/settlement");
}

export function fetchCreatorSettlement() {
  return api<CreatorSettlementStats>("/earnings/settlement");
}

export function fetchMyPurchasesWithSettlement() {
  return api<PurchaseWithSettlement[]>("/users/me/purchases");
}
