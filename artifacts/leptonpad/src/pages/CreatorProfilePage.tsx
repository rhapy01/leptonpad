import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetMe } from "@workspace/api-client-react";
import { PlatformLayout } from "@/components/PlatformLayout";
import { ContentCover } from "@/components/ContentCover";
import { CreatorName } from "@/components/CreatorName";
import { useI18n } from "@/lib/i18n";
import { fetchCreatorProfile, followCreator, unfollowCreator } from "@/lib/platformApi";
import { useToast } from "@/hooks/use-toast";

export default function CreatorProfilePage({ clerkId }: { clerkId: string }) {
  const { data: me } = useGetMe();
  const { toast } = useToast();
  const { t } = useI18n();
  const qc = useQueryClient();
  const [shareCopied, setShareCopied] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["creator", clerkId],
    queryFn: () => fetchCreatorProfile(clerkId),
  });

  const followMutation = useMutation({
    mutationFn: () => profile?.isFollowing ? unfollowCreator(clerkId) : followCreator(clerkId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["creator", clerkId] });
      toast({
        title: profile?.isFollowing
          ? "Unsubscribed from updates"
          : "Subscribed — you'll get email when they publish",
      });
    },
  });

  const shareProfile = async () => {
    const url = `${window.location.origin}/creator/${clerkId}`;
    await navigator.clipboard.writeText(url);
    setShareCopied(true);
    toast({ title: "Profile link copied" });
    setTimeout(() => setShareCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <PlatformLayout>
        <div className="max-w-4xl mx-auto px-4 py-16 animate-pulse">
          <div className="h-40 bg-black/5 rounded mb-8" />
          <div className="h-6 bg-black/5 rounded w-1/3 mb-4" />
        </div>
      </PlatformLayout>
    );
  }

  if (!profile) {
    return (
      <PlatformLayout>
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <p style={{ color: "#78716C" }}>Creator not found.</p>
        </div>
      </PlatformLayout>
    );
  }

  const isSelf = me?.clerkId === clerkId;

  return (
    <PlatformLayout>
      <div className="max-w-4xl mx-auto">
        {/* Banner */}
        <div
          className="h-40 sm:h-52 w-full relative"
          style={{
            background: profile.bannerUrl
              ? `url(${profile.bannerUrl}) center/cover no-repeat`
              : "linear-gradient(135deg, rgba(200,150,12,0.25) 0%, rgba(28,25,23,0.08) 100%)",
          }}
        />

        <div className="px-4 sm:px-6 pb-10 -mt-12 relative">
          <div className="flex flex-col sm:flex-row gap-6 items-start mb-10">
            {profile.imageUrl ? (
              <img
                src={profile.imageUrl}
                alt={profile.name}
                className="w-24 h-24 rounded-full object-cover border-4 shrink-0"
                style={{ borderColor: "#ffffff" }}
              />
            ) : (
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center text-2xl font-bold border-4 shrink-0"
                style={{ background: "rgba(28,25,23,0.08)", color: "#78716C", borderColor: "#ffffff" }}
              >
                {profile.name[0]}
              </div>
            )}
            <div className="flex-1 pt-2 sm:pt-14">
              <h1
                className="mb-1"
                style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "2rem", fontWeight: 700, color: "#1C1917" }}
              >
                <CreatorName name={profile.name} verified={profile.verified} size="lg" />
              </h1>
              {profile.bio && (
                <p className="text-sm mb-3 max-w-xl" style={{ color: "#57534E", fontFamily: "'Lora', Georgia, serif", lineHeight: 1.7 }}>
                  {profile.bio}
                </p>
              )}
              <div className="flex flex-wrap gap-4 text-xs mb-4" style={{ color: "#78716C", fontFamily: "sans-serif" }}>
                <span>{profile.subscriberCount ?? profile.followerCount} subscribers</span>
                <span>{profile.contentCount} works</span>
                {profile.country && <span>📍 {profile.country}</span>}
                <span>Joined {new Date(profile.joinDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {profile.website && (
                  <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-xs px-3 py-1 rounded" style={{ border: "1px solid rgba(28,25,23,0.15)", color: "#78716C" }}>
                    Website
                  </a>
                )}
                {profile.twitterUrl && (
                  <a href={profile.twitterUrl} target="_blank" rel="noopener noreferrer" className="text-xs px-3 py-1 rounded" style={{ border: "1px solid rgba(28,25,23,0.15)", color: "#78716C" }}>
                    X / Twitter
                  </a>
                )}
                {profile.linkedinUrl && (
                  <a href={profile.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-xs px-3 py-1 rounded" style={{ border: "1px solid rgba(28,25,23,0.15)", color: "#78716C" }}>
                    LinkedIn
                  </a>
                )}
                <a href={`/api/creators/${clerkId}/rss`} target="_blank" rel="noopener noreferrer" className="text-xs px-3 py-1 rounded" style={{ border: "1px solid rgba(28,25,23,0.15)", color: "#78716C" }}>
                  RSS Feed
                </a>
                <button
                  type="button"
                  onClick={() => void shareProfile()}
                  className="text-xs px-3 py-1 rounded"
                  style={{ border: "1px solid rgba(28,25,23,0.15)", color: "#78716C" }}
                >
                  {shareCopied ? "Copied!" : "Share profile"}
                </button>
                {!isSelf && me && (
                  <button
                    type="button"
                    onClick={() => followMutation.mutate()}
                    disabled={followMutation.isPending}
                    className="text-xs px-4 py-1.5 rounded font-medium"
                    style={{
                      background: profile.isFollowing ? "transparent" : "#1C1917",
                      color: profile.isFollowing ? "#78716C" : "#FAF7F2",
                      border: `1px solid ${profile.isFollowing ? "rgba(28,25,23,0.2)" : "#1C1917"}`,
                    }}
                  >
                    {profile.isFollowing ? t("creator.subscribed") : t("creator.subscribe")}
                  </button>
                )}
                {isSelf && (
                  <>
                    <Link href="/dashboard" className="text-xs px-4 py-1.5 rounded font-medium" style={{ border: "1px solid rgba(28,25,23,0.2)", color: "#78716C" }}>
                      Dashboard
                    </Link>
                    <Link href="/settings" className="text-xs px-4 py-1.5 rounded font-medium" style={{ border: "1px solid rgba(28,25,23,0.2)", color: "#78716C" }}>
                      Edit profile
                    </Link>
                  </>
                )}
              </div>
              {!isSelf && (
                <p className="text-[11px] mt-2" style={{ color: "#A8A29E" }}>
                  Subscribe for email alerts when this creator publishes — not a paid subscription.
                </p>
              )}
            </div>
          </div>

          <div style={{ borderTop: "2px solid #1C1917", paddingTop: "16px" }}>
            <h2 className="editorial-label mb-6" style={{ color: "#78716C" }}>Published Works</h2>
            <div className="grid gap-6 sm:grid-cols-2">
              {profile.works.map(work => (
                <Link key={work.id} href={`/content/${work.id}`} className="group block">
                  <ContentCover
                    coverImageUrl={work.coverImageUrl}
                    categorySlug={work.categorySlug}
                    id={work.id}
                    title={work.title}
                    className="mb-3"
                  />
                  <h3 className="text-base font-semibold group-hover:underline" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1C1917" }}>
                    {work.title}
                  </h3>
                  <p className="text-xs mt-1" style={{ color: "#78716C" }}>
                    {work.viewCount} views · {work.purchaseCount} purchases · ${work.price} USDC
                  </p>
                  {work.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {work.tags.slice(0, 4).map(tag => (
                        <span key={tag} className="text-[10px] px-2 py-0.5 rounded" style={{ background: "rgba(28,25,23,0.06)", color: "#78716C" }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              ))}
            </div>
            {profile.works.length === 0 && (
              <p className="text-sm" style={{ color: "#78716C" }}>No published works yet.</p>
            )}
          </div>
        </div>
      </div>
    </PlatformLayout>
  );
}
