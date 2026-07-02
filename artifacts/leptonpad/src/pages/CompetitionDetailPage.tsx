import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useGetMe } from "@workspace/api-client-react";
import { PlatformLayout } from "@/components/PlatformLayout";
import { fetchCompetition, enterCompetition } from "@/lib/platformApi";
import { useToast } from "@/hooks/use-toast";

export default function CompetitionDetailPage({ slug: slugProp }: { slug?: string }) {
  const params = useParams<{ slug: string }>();
  const slug = slugProp ?? params.slug;
  const { data: me } = useGetMe();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");

  const { data: comp, isLoading } = useQuery({
    queryKey: ["competition", slug],
    queryFn: () => fetchCompetition(slug!),
    enabled: !!slug,
  });

  const enterMut = useMutation({
    mutationFn: () => enterCompetition(comp!.id, { title, excerpt }),
    onSuccess: () => { toast({ title: "Entry submitted!" }); setTitle(""); setExcerpt(""); },
    onError: (e) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading || !comp) {
    return <PlatformLayout><div className="max-w-3xl mx-auto px-4 py-16 animate-pulse"><div className="h-8 bg-black/5 rounded w-2/3" /></div></PlatformLayout>;
  }

  return (
    <PlatformLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <Link href="/competitions" className="text-xs mb-6 inline-block" style={{ color: "#78716C" }}>← All competitions</Link>
        {comp.coverImageUrl && <img src={comp.coverImageUrl} alt="" className="w-full aspect-video object-cover rounded mb-6" />}
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "2rem", fontWeight: 700, color: "#1C1917" }}>{comp.title}</h1>
        <p className="text-sm mt-2 mb-4" style={{ color: "#C8960C" }}>Theme: {comp.theme}</p>
        <p className="text-sm mb-6" style={{ color: "#57534E", lineHeight: 1.7 }}>{comp.description}</p>
        <div className="flex gap-4 text-xs mb-8" style={{ color: "#78716C" }}>
          {comp.region && <span>📍 {comp.region}</span>}
          <span>Deadline: {new Date(comp.deadline).toLocaleDateString()}</span>
          {comp.prizeDescription && <span>🏆 {comp.prizeDescription}</span>}
        </div>

        {me ? (
          <div className="p-6 rounded mb-8" style={{ background: "rgba(28,25,23,0.04)", border: "1px solid rgba(28,25,23,0.1)" }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: "#1C1917" }}>Submit your entry</h2>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Entry title" className="w-full mb-3 px-3 py-2 text-sm rounded" style={{ border: "1px solid rgba(28,25,23,0.15)" }} />
            <textarea value={excerpt} onChange={e => setExcerpt(e.target.value)} placeholder="Brief excerpt or summary" rows={4} className="w-full mb-3 px-3 py-2 text-sm rounded" style={{ border: "1px solid rgba(28,25,23,0.15)" }} />
            <button type="button" onClick={() => enterMut.mutate()} disabled={!title.trim() || enterMut.isPending}
              className="px-4 py-2 text-sm rounded" style={{ background: "#1C1917", color: "#FAF7F2" }}>
              Submit entry
            </button>
          </div>
        ) : (
          <p className="text-sm mb-8" style={{ color: "#78716C" }}>Sign in to submit an entry.</p>
        )}

        {comp.entries && comp.entries.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold mb-4" style={{ color: "#78716C" }}>{comp.entries.length} entries</h2>
            <ul className="space-y-3">
              {comp.entries.map(e => (
                <li key={e.id} className="p-4 rounded" style={{ background: "#fff", border: "1px solid rgba(28,25,23,0.08)" }}>
                  <p className="font-medium text-sm" style={{ color: "#1C1917" }}>{e.title}</p>
                  {e.excerpt && <p className="text-xs mt-1" style={{ color: "#78716C" }}>{e.excerpt}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </PlatformLayout>
  );
}
