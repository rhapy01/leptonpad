import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useListContent, useListCategories } from "@workspace/api-client-react";
import { DashboardShell } from "@/components/DashboardShell";
import { TipTapEditor } from "@/components/TipTapEditor";
import {
  fetchAdminOverview,
  fetchAdminUsers,
  fetchAdminAds,
  fetchAdminAdSubmissions,
  createAdminAd,
  updateAdminAd,
  deleteAdminAd,
  reviewAdminAdSubmission,
  setContentFeatured,
  setUserVerified,
  deleteAdminContent,
  previewNewsletter,
  sendNewsletter,
  type AdminAdCampaign,
  type AdminAdCampaignInput,
  type AdminAdSubmission,
} from "@/lib/dashboardApi";

function isEditorContentEmpty(html: string): boolean {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return !text;
}

const EMPTY_AD_FORM: AdminAdCampaignInput = {
  title: "",
  advertiser: "",
  targetUrl: "",
  imageUrl: "",
  categorySlug: "",
  active: true,
  durationDays: 7,
};

const AD_DURATION_OPTIONS = [
  { days: 7, label: "1 week" },
  { days: 14, label: "2 weeks" },
  { days: 30, label: "1 month" },
];

function adToForm(ad: AdminAdCampaign): AdminAdCampaignInput {
  return {
    title: ad.title,
    advertiser: ad.advertiser,
    targetUrl: ad.targetUrl,
    imageUrl: ad.imageUrl ?? "",
    categorySlug: ad.categorySlug ?? "",
    active: ad.active,
  };
}

export default function AdminDashboardPage() {
  const qc = useQueryClient();
  const [newsletterSubject, setNewsletterSubject] = useState("");
  const [newsletterBody, setNewsletterBody] = useState("");
  const [newsletterStatus, setNewsletterStatus] = useState<string | null>(null);
  const [newsletterBusy, setNewsletterBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [adForm, setAdForm] = useState<AdminAdCampaignInput>(EMPTY_AD_FORM);
  const [editingAdId, setEditingAdId] = useState<number | null>(null);
  const [adBusy, setAdBusy] = useState(false);
  const [showAdForm, setShowAdForm] = useState(false);

  const { data: overview, isLoading } = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: fetchAdminOverview,
  });
  const { data: users } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: fetchAdminUsers,
  });
  const { data: content } = useListContent({ limit: 50 });
  const { data: categories } = useListCategories();
  const { data: ads } = useQuery({
    queryKey: ["admin", "ads"],
    queryFn: fetchAdminAds,
  });
  const { data: adSubmissions } = useQuery({
    queryKey: ["admin", "ad-submissions", "pending"],
    queryFn: () => fetchAdminAdSubmissions("pending"),
  });

  const resetAdForm = () => {
    setAdForm(EMPTY_AD_FORM);
    setEditingAdId(null);
    setShowAdForm(false);
  };

  const startNewAd = () => {
    setActionError(null);
    setAdForm(EMPTY_AD_FORM);
    setEditingAdId(null);
    setShowAdForm(true);
  };

  const startEditAd = (ad: AdminAdCampaign) => {
    setActionError(null);
    setAdForm(adToForm(ad));
    setEditingAdId(ad.id);
    setShowAdForm(true);
  };

  const saveAd = async () => {
    setActionError(null);
    setActionNotice(null);
    setAdBusy(true);
    try {
      const payload: AdminAdCampaignInput = {
        title: adForm.title.trim(),
        advertiser: adForm.advertiser.trim(),
        targetUrl: adForm.targetUrl.trim(),
        imageUrl: adForm.imageUrl?.trim() ? adForm.imageUrl.trim() : null,
        categorySlug: adForm.categorySlug?.trim() ? adForm.categorySlug.trim() : null,
        active: adForm.active ?? true,
        durationDays: editingAdId ? undefined : (adForm.durationDays ?? 7),
      };
      if (editingAdId) {
        await updateAdminAd(editingAdId, payload);
        setActionNotice(`Updated sponsored ad "${payload.title}".`);
      } else {
        await createAdminAd(payload);
        setActionNotice(`Created sponsored ad "${payload.title}".`);
      }
      qc.invalidateQueries({ queryKey: ["admin", "ads"] });
      qc.invalidateQueries({ queryKey: ["ads"] });
      resetAdForm();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to save ad");
    } finally {
      setAdBusy(false);
    }
  };

  const toggleAdActive = async (ad: AdminAdCampaign) => {
    setActionError(null);
    setActionNotice(null);
    try {
      await updateAdminAd(ad.id, { active: !ad.active });
      qc.invalidateQueries({ queryKey: ["admin", "ads"] });
      qc.invalidateQueries({ queryKey: ["ads"] });
      setActionNotice(`${ad.active ? "Paused" : "Activated"} "${ad.title}".`);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to update ad");
    }
  };

  const removeAd = async (ad: AdminAdCampaign) => {
    if (!confirm(`Delete sponsored ad "${ad.title}"?`)) return;
    setActionError(null);
    setActionNotice(null);
    try {
      await deleteAdminAd(ad.id);
      qc.invalidateQueries({ queryKey: ["admin", "ads"] });
      qc.invalidateQueries({ queryKey: ["ads"] });
      if (editingAdId === ad.id) resetAdForm();
      setActionNotice(`Deleted "${ad.title}".`);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to delete ad");
    }
  };

  const reviewSubmission = async (submission: AdminAdSubmission, status: "approved" | "rejected") => {
    const verb = status === "approved" ? "Approve" : "Reject";
    if (!confirm(`${verb} ad from ${submission.businessName}?`)) return;
    setActionError(null);
    setActionNotice(null);
    try {
      await reviewAdminAdSubmission(submission.id, status);
      qc.invalidateQueries({ queryKey: ["admin", "ad-submissions"] });
      qc.invalidateQueries({ queryKey: ["admin", "ads"] });
      qc.invalidateQueries({ queryKey: ["admin", "overview"] });
      qc.invalidateQueries({ queryKey: ["ads"] });
      setActionNotice(
        status === "approved"
          ? `"${submission.businessName}" is now live in the feed.`
          : `Rejected submission from ${submission.businessName}.`,
      );
    } catch (e) {
      setActionError(e instanceof Error ? e.message : `Failed to ${status} submission`);
    }
  };

  const toggleFeatured = async (id: number, featured: boolean) => {
    setActionError(null);
    try {
      await setContentFeatured(id, featured);
      qc.invalidateQueries({ queryKey: ["admin", "overview"] });
      qc.invalidateQueries({ queryKey: ["/api/content"] });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to update featured");
    }
  };

  const removeContent = async (id: number, title: string) => {
    if (!confirm(`Delete "${title}"? This removes content that violates terms and cannot be undone.`)) return;
    setActionError(null);
    try {
      await deleteAdminContent(id, "terms violation");
      qc.invalidateQueries({ queryKey: ["admin", "overview"] });
      qc.invalidateQueries({ queryKey: ["/api/content"] });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to delete content");
    }
  };

  const toggleVerified = async (clerkId: string, name: string, verified: boolean) => {
    const action = verified ? "grant" : "revoke";
    if (!confirm(`${verified ? "Grant" : "Revoke"} verified badge for ${name}? ${verified ? "They will keep 100% of sales." : ""}`)) return;
    setActionError(null);
    setActionNotice(null);
    try {
      await setUserVerified(clerkId, verified);
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ["admin", "overview"] });
      qc.invalidateQueries({ queryKey: ["/api/users/me"] });
      setActionNotice(
        verified
          ? `${name} is now a verified creator (100% revenue).`
          : `Removed verified badge from ${name}.`,
      );
    } catch (e) {
      setActionError(e instanceof Error ? e.message : `Failed to ${action} verification`);
    }
  };

  const handlePreviewNewsletter = async () => {
    setNewsletterBusy(true);
    setNewsletterStatus(null);
    try {
      const result = await previewNewsletter(newsletterSubject, newsletterBody);
      setNewsletterStatus(`Preview: would send to ${result.recipientCount} users`);
    } catch (e) {
      setNewsletterStatus(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setNewsletterBusy(false);
    }
  };

  const handleSendNewsletter = async () => {
    if (!confirm(`Send newsletter "${newsletterSubject}" to all users?`)) return;
    setNewsletterBusy(true);
    setNewsletterStatus(null);
    try {
      const result = await sendNewsletter(newsletterSubject, newsletterBody);
      setNewsletterStatus(`Sent to ${result.sent} users`);
      setNewsletterSubject("");
      setNewsletterBody("");
    } catch (e) {
      setNewsletterStatus(e instanceof Error ? e.message : "Send failed");
    } finally {
      setNewsletterBusy(false);
    }
  };

  const stat = (label: string, value: string | number) => (
    <div className="p-4" style={{ background: "#FFFFFF", border: "1px solid rgba(28,25,23,0.12)" }}>
      <p className="editorial-label mb-1" style={{ color: "#78716C" }}>{label}</p>
      <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1.35rem", fontWeight: 700 }}>
        {value}
      </p>
    </div>
  );

  const btnStyle = (active: boolean, danger = false) => ({
    background: active ? (danger ? "#B91C1C" : "#1C1917") : "transparent",
    color: active ? "#F7F3EC" : danger ? "#B91C1C" : "#78716C",
    border: `1px solid ${danger ? "rgba(185,28,28,0.4)" : "rgba(28,25,23,0.2)"}`,
  });

  return (
    <DashboardShell
      title="Admin dashboard"
      subtitle="Newsletter, feed ads, moderation, verification badges, and platform metrics"
    >
      {isLoading ? (
        <p style={{ color: "#78716C" }}>Loading…</p>
      ) : (
        <>
          {actionNotice && (
            <p className="mb-4 text-sm p-3" style={{ background: "#ECFDF5", color: "#047857", border: "1px solid #A7F3D0" }}>
              {actionNotice}
            </p>
          )}
          {actionError && (
            <p className="mb-4 text-sm p-3" style={{ background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA" }}>
              {actionError}
            </p>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
            {stat("Total USDC paid", `$${Number(overview?.totalUsdcPaid ?? 0).toFixed(2)}`)}
            {stat("Payments", overview?.totalPayments ?? 0)}
            {stat("Content", overview?.totalContent ?? 0)}
            {stat("Featured", overview?.featuredCount ?? 0)}
            {stat("Users", overview?.totalUsers ?? 0)}
            {stat("Verified creators", overview?.verifiedCreators ?? 0)}
            {stat("Pending ads", overview?.pendingAdSubmissions ?? 0)}
          </div>

          {/* Newsletter */}
          <section className="mb-8 p-5" style={{ background: "#FFFFFF", border: "1px solid rgba(28,25,23,0.12)" }}>
            <h2 className="font-bold mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              Newsletter
            </h2>
            <p className="text-sm mb-4" style={{ color: "#78716C" }}>
              Broadcast to all registered users via email — use the same rich editor as article publishing
              {overview?.emailConfigured === false && " (email not configured — set SMTP_USER and SMTP_PASS in .env)"}
            </p>
            <input
              type="text"
              placeholder="Subject"
              value={newsletterSubject}
              onChange={e => setNewsletterSubject(e.target.value)}
              className="w-full mb-3 px-3 py-2 text-sm"
              style={{ border: "1px solid rgba(28,25,23,0.15)", background: "#ffffff" }}
            />
            <TipTapEditor
              value={newsletterBody}
              onChange={setNewsletterBody}
              placeholder="Write your newsletter — bold, headings, lists, links, and images supported."
            />
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                type="button"
                disabled={newsletterBusy || !newsletterSubject.trim() || isEditorContentEmpty(newsletterBody)}
                onClick={handlePreviewNewsletter}
                className="text-xs px-4 py-2 font-semibold"
                style={btnStyle(false)}
              >
                Preview audience
              </button>
              <button
                type="button"
                disabled={newsletterBusy || !newsletterSubject.trim() || isEditorContentEmpty(newsletterBody)}
                onClick={handleSendNewsletter}
                className="text-xs px-4 py-2 font-semibold"
                style={{ ...btnStyle(true), background: "#C8960C", color: "#1C1917", border: "none" }}
              >
                Send newsletter
              </button>
            </div>
            {newsletterStatus && (
              <p className="text-sm mt-3" style={{ color: "#57534E" }}>{newsletterStatus}</p>
            )}
          </section>

          {/* Feed ads */}
          <section className="mb-8 p-5" style={{ background: "#FFFFFF", border: "1px solid rgba(28,25,23,0.12)" }}>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="font-bold mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                  Feed ads
                </h2>
                <p className="text-sm" style={{ color: "#78716C" }}>
                  Sponsored banners at the top of the feed. Leave category empty to show on all feeds.
                </p>
              </div>
              <button
                type="button"
                onClick={startNewAd}
                className="text-xs px-4 py-2 font-semibold shrink-0"
                style={{ ...btnStyle(true), background: "#C8960C", color: "#1C1917", border: "none" }}
              >
                New ad
              </button>
            </div>

            {(adSubmissions ?? []).length > 0 && (
              <div className="mb-5">
                <p className="text-xs font-semibold mb-2 editorial-label" style={{ color: "#78716C" }}>
                  Pending submissions ({adSubmissions?.length ?? 0})
                </p>
                <div className="space-y-3">
                  {(adSubmissions ?? []).map((sub) => (
                    <div
                      key={sub.id}
                      className="p-4 flex flex-col sm:flex-row gap-4"
                      style={{ background: "#FAF7F2", border: "1px solid rgba(28,25,23,0.1)" }}
                    >
                      <img
                        src={sub.imageUrl}
                        alt=""
                        className="w-full sm:w-32 h-20 object-cover rounded shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm" style={{ color: "#1C1917" }}>{sub.headline}</p>
                        <p className="text-xs" style={{ color: "#78716C" }}>
                          {sub.businessName} · {sub.durationLabel} · {sub.contactEmail}
                        </p>
                        <a
                          href={sub.targetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs underline"
                          style={{ color: "#57534E" }}
                        >
                          {sub.targetUrl}
                        </a>
                      </div>
                      <div className="flex gap-2 shrink-0 items-start">
                        <button
                          type="button"
                          onClick={() => reviewSubmission(sub, "approved")}
                          className="text-xs px-3 py-1.5 font-semibold"
                          style={{ ...btnStyle(true), background: "#047857", border: "none" }}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => reviewSubmission(sub, "rejected")}
                          className="text-xs px-3 py-1.5 font-semibold"
                          style={btnStyle(false, true)}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {showAdForm && (
              <div className="mb-5 p-4" style={{ background: "#FAF7F2", border: "1px solid rgba(28,25,23,0.1)" }}>
                <p className="text-xs font-semibold mb-3 editorial-label" style={{ color: "#78716C" }}>
                  {editingAdId ? "Edit campaign" : "New campaign"}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <input
                    type="text"
                    placeholder="Headline"
                    value={adForm.title}
                    onChange={e => setAdForm(f => ({ ...f, title: e.target.value }))}
                    className="w-full px-3 py-2 text-sm"
                    style={{ border: "1px solid rgba(28,25,23,0.15)", background: "#ffffff" }}
                  />
                  <input
                    type="text"
                    placeholder="Advertiser name"
                    value={adForm.advertiser}
                    onChange={e => setAdForm(f => ({ ...f, advertiser: e.target.value }))}
                    className="w-full px-3 py-2 text-sm"
                    style={{ border: "1px solid rgba(28,25,23,0.15)", background: "#ffffff" }}
                  />
                  <input
                    type="url"
                    placeholder="Learn more URL (https://…)"
                    value={adForm.targetUrl}
                    onChange={e => setAdForm(f => ({ ...f, targetUrl: e.target.value }))}
                    className="w-full px-3 py-2 text-sm sm:col-span-2"
                    style={{ border: "1px solid rgba(28,25,23,0.15)", background: "#ffffff" }}
                  />
                  <input
                    type="url"
                    placeholder="Image URL (optional)"
                    value={adForm.imageUrl ?? ""}
                    onChange={e => setAdForm(f => ({ ...f, imageUrl: e.target.value }))}
                    className="w-full px-3 py-2 text-sm sm:col-span-2"
                    style={{ border: "1px solid rgba(28,25,23,0.15)", background: "#ffffff" }}
                  />
                  <select
                    value={adForm.categorySlug ?? ""}
                    onChange={e => setAdForm(f => ({ ...f, categorySlug: e.target.value }))}
                    className="w-full px-3 py-2 text-sm"
                    style={{ border: "1px solid rgba(28,25,23,0.15)", background: "#ffffff" }}
                  >
                    <option value="">All categories</option>
                    {(categories ?? []).map(cat => (
                      <option key={cat.slug} value={cat.slug}>{cat.name}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-sm px-1" style={{ color: "#57534E" }}>
                    <input
                      type="checkbox"
                      checked={adForm.active ?? true}
                      onChange={e => setAdForm(f => ({ ...f, active: e.target.checked }))}
                    />
                    Active (visible in feed)
                  </label>
                  {!editingAdId && (
                    <select
                      value={adForm.durationDays ?? 7}
                      onChange={e => setAdForm(f => ({ ...f, durationDays: Number(e.target.value) }))}
                      className="w-full px-3 py-2 text-sm"
                      style={{ border: "1px solid rgba(28,25,23,0.15)", background: "#ffffff" }}
                    >
                      {AD_DURATION_OPTIONS.map(opt => (
                        <option key={opt.days} value={opt.days}>Run for {opt.label}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={adBusy || !adForm.title.trim() || !adForm.advertiser.trim() || !adForm.targetUrl.trim()}
                    onClick={saveAd}
                    className="text-xs px-4 py-2 font-semibold"
                    style={btnStyle(true)}
                  >
                    {adBusy ? "Saving…" : editingAdId ? "Save changes" : "Create ad"}
                  </button>
                  <button
                    type="button"
                    disabled={adBusy}
                    onClick={resetAdForm}
                    className="text-xs px-4 py-2 font-semibold"
                    style={btnStyle(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(28,25,23,0.15)" }}>
                    {["Campaign", "Category", "Expires", "Status", "Clicks", "Actions"].map(h => (
                      <th key={h} className="text-left py-2 pr-4 editorial-label" style={{ color: "#78716C" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(ads ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-4" style={{ color: "#78716C" }}>
                        No ads yet — create one to show in the feed.
                      </td>
                    </tr>
                  ) : (
                    (ads ?? []).map(ad => (
                      <tr key={ad.id} style={{ borderBottom: "1px solid rgba(28,25,23,0.06)" }}>
                        <td className="py-2 pr-4">
                          <p className="font-medium" style={{ color: "#1C1917" }}>{ad.title}</p>
                          <p className="text-xs" style={{ color: "#78716C" }}>{ad.advertiser}</p>
                        </td>
                        <td className="py-2 pr-4" style={{ color: "#57534E" }}>
                          {ad.categorySlug ?? "All feeds"}
                        </td>
                        <td className="py-2 pr-4" style={{ color: "#78716C" }}>
                          {ad.expiresAt
                            ? new Date(ad.expiresAt).toLocaleDateString()
                            : "No expiry"}
                        </td>
                        <td className="py-2 pr-4">
                          {ad.active ? (
                            <span style={{ color: "#047857", fontWeight: 600 }}>Live</span>
                          ) : (
                            <span style={{ color: "#78716C" }}>Paused</span>
                          )}
                        </td>
                        <td className="py-2 pr-4" style={{ color: "#78716C" }}>
                          {ad.clickCount} / {ad.impressionCount}
                        </td>
                        <td className="py-2 pr-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => startEditAd(ad)}
                              className="text-xs px-3 py-1.5 font-semibold"
                              style={btnStyle(false)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleAdActive(ad)}
                              className="text-xs px-3 py-1.5 font-semibold"
                              style={btnStyle(ad.active)}
                            >
                              {ad.active ? "Pause" : "Activate"}
                            </button>
                            <button
                              type="button"
                              onClick={() => removeAd(ad)}
                              className="text-xs px-3 py-1.5 font-semibold"
                              style={btnStyle(false, true)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Content moderation */}
          <h2 className="font-bold mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            Content moderation
          </h2>
          <p className="text-sm mb-3" style={{ color: "#78716C" }}>
            Remove content that violates terms. Feature editorial picks.
          </p>
          <div className="space-y-2 mb-8">
            {(content?.items ?? []).map(item => {
              const featured = (item as { featured?: boolean }).featured ?? false;
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 p-3"
                  style={{ background: "#FFFFFF", border: "1px solid rgba(28,25,23,0.08)" }}
                >
                  <span className="text-sm line-clamp-1 flex-1" style={{ color: "#1C1917" }}>
                    {item.title}
                  </span>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleFeatured(item.id, !featured)}
                      className="text-xs px-3 py-1.5 font-semibold"
                      style={btnStyle(featured)}
                    >
                      {featured ? "Featured" : "Feature"}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeContent(item.id, item.title)}
                      className="text-xs px-3 py-1.5 font-semibold"
                      style={btnStyle(false, true)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Users & verification */}
          <h2 className="font-bold mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            Users &amp; verification
          </h2>
          <p className="text-sm mb-3" style={{ color: "#78716C" }}>
            Verified creators keep <strong>100%</strong> of revenue (no platform fee) and display a badge.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(28,25,23,0.15)" }}>
                  {["Name", "Email", "Verified", "Admin", "Joined", "Actions"].map(h => (
                    <th key={h} className="text-left py-2 pr-4 editorial-label" style={{ color: "#78716C" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(users ?? []).map(u => (
                  <tr key={u.id} style={{ borderBottom: "1px solid rgba(28,25,23,0.06)" }}>
                    <td className="py-2 pr-4">{u.name}</td>
                    <td className="py-2 pr-4" style={{ color: "#57534E" }}>{u.email}</td>
                    <td className="py-2 pr-4">
                      {u.verified ? (
                        <span style={{ color: "#C8960C", fontWeight: 600 }}>✓ 100%</span>
                      ) : "—"}
                    </td>
                    <td className="py-2 pr-4">{u.isAdmin ? "Yes" : "—"}</td>
                    <td className="py-2 pr-4" style={{ color: "#78716C" }}>
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2 pr-4">
                      <button
                        type="button"
                        onClick={() => toggleVerified(u.clerkId, u.name, !u.verified)}
                        className="text-xs px-3 py-1.5 font-semibold whitespace-nowrap"
                        style={btnStyle(u.verified)}
                      >
                        {u.verified ? "Revoke badge" : "Verify (100%)"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </DashboardShell>
  );
}
