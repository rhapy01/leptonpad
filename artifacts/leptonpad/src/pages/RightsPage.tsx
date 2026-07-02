import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useGetMe } from "@workspace/api-client-react";
import { PlatformLayout } from "@/components/PlatformLayout";
import { fetchRightsList, inquireRights } from "@/lib/platformApi";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";

const RIGHTS_TYPES = ["film", "translation", "audio", "theatre", "serial"];

export default function RightsPage() {
  const { t } = useI18n();
  const { data: me } = useGetMe();
  const { toast } = useToast();
  const [typeFilter, setTypeFilter] = useState("");
  const [inquireId, setInquireId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const { data: rights = [], isLoading } = useQuery({
    queryKey: ["rights", typeFilter],
    queryFn: () => fetchRightsList(typeFilter || undefined),
  });

  const inquireMut = useMutation({
    mutationFn: () => inquireRights(inquireId!, message),
    onSuccess: () => { toast({ title: "Inquiry sent" }); setInquireId(null); setMessage(""); },
  });

  return (
    <PlatformLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <p className="editorial-label mb-2" style={{ color: "#78716C" }}>LeptonPad · Licensing</p>
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "2rem", fontWeight: 700, color: "#1C1917" }}>
          {t("rights.title")}
        </h1>
        <p className="text-sm mb-6 mt-2" style={{ color: "#78716C" }}>
          Film, translation, audio, and adaptation rights for African stories.
        </p>

        <div className="flex flex-wrap gap-2 mb-6">
          <button type="button" onClick={() => setTypeFilter("")}
            className="text-xs px-3 py-1 rounded" style={{ background: !typeFilter ? "rgba(28,25,23,0.1)" : "transparent", color: "#78716C" }}>
            All
          </button>
          {RIGHTS_TYPES.map(rt => (
            <button key={rt} type="button" onClick={() => setTypeFilter(rt)}
              className="text-xs px-3 py-1 rounded capitalize" style={{ background: typeFilter === rt ? "rgba(28,25,23,0.1)" : "transparent", color: "#78716C" }}>
              {rt}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="animate-pulse h-24 bg-black/5 rounded" />
        ) : rights.length === 0 ? (
          <p className="text-sm" style={{ color: "#78716C" }}>No rights listings yet. Creators can list rights from their content pages.</p>
        ) : (
          <div className="space-y-4">
            {rights.map(r => (
              <div key={r.id} className="p-5 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                style={{ background: "#fff", border: "1px solid rgba(28,25,23,0.1)" }}>
                <div>
                  <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "#C8960C" }}>{r.rightsType} · {r.status}</p>
                  <Link href={`/content/${r.contentId}`} className="text-base font-semibold hover:underline" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1C1917" }}>
                    {r.contentTitle}
                  </Link>
                  {r.territory && <p className="text-xs mt-1" style={{ color: "#78716C" }}>Territory: {r.territory}</p>}
                </div>
                {me && r.status === "available" && (
                  inquireId === r.id ? (
                    <div className="flex gap-2 flex-1 max-w-md">
                      <input value={message} onChange={e => setMessage(e.target.value)} placeholder="Your inquiry…" className="flex-1 text-sm px-2 py-1.5 rounded" style={{ border: "1px solid rgba(28,25,23,0.15)" }} />
                      <button type="button" onClick={() => inquireMut.mutate()} disabled={!message.trim()} className="text-xs px-3 py-1.5 rounded" style={{ background: "#1C1917", color: "#FAF7F2" }}>Send</button>
                      <button type="button" onClick={() => setInquireId(null)} className="text-xs px-2" style={{ color: "#78716C" }}>✕</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setInquireId(r.id)} className="text-xs px-4 py-2 rounded" style={{ border: "1px solid rgba(28,25,23,0.15)", color: "#1C1917" }}>
                      Inquire
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </PlatformLayout>
  );
}
