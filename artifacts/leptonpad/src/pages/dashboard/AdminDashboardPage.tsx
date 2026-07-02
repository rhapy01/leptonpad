import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useListContent } from "@workspace/api-client-react";
import { DashboardShell } from "@/components/DashboardShell";
import { TipTapEditor } from "@/components/TipTapEditor";
import {
  fetchAdminOverview,
  fetchAdminUsers,
  setContentFeatured,
  setUserVerified,
  deleteAdminContent,
  previewNewsletter,
  sendNewsletter,
} from "@/lib/dashboardApi";

function isEditorContentEmpty(html: string): boolean {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return !text;
}

export default function AdminDashboardPage() {
  const qc = useQueryClient();
  const [newsletterSubject, setNewsletterSubject] = useState("");
  const [newsletterBody, setNewsletterBody] = useState("");
  const [newsletterStatus, setNewsletterStatus] = useState<string | null>(null);
  const [newsletterBusy, setNewsletterBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const { data: overview, isLoading } = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: fetchAdminOverview,
  });
  const { data: users } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: fetchAdminUsers,
  });
  const { data: content } = useListContent({ limit: 50 });

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
      subtitle="Newsletter, moderation, verification badges (100% revenue), and platform metrics"
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
                      {!u.isAdmin && (
                        <button
                          type="button"
                          onClick={() => toggleVerified(u.clerkId, u.name, !u.verified)}
                          className="text-xs px-3 py-1.5 font-semibold whitespace-nowrap"
                          style={btnStyle(u.verified)}
                        >
                          {u.verified ? "Revoke badge" : "Verify (100%)"}
                        </button>
                      )}
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
