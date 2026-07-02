import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { Show } from "@clerk/react";
import {
  useGetContent,
  useCheckContentAccess,
  useTrackContentView,
  getCheckContentAccessQueryKey,
  getGetContentQueryKey,
  getGetMyPurchasesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PlatformLayout } from "@/components/PlatformLayout";
import { ContentCover } from "@/components/ContentCover";
import { SeoHead } from "@/components/SeoHead";
import { ContentEngagement } from "@/components/ContentEngagement";
import { CreatorName } from "@/components/CreatorName";
import { useAppWallet } from "@/hooks/useAppWallet";
import { useAuthReady } from "@/hooks/useAuthReady";
import { unlockContentWithRetry } from "@/lib/appWallet";
import { notifyPaymentFailed, notifyPaymentPending, notifyPaymentSuccess } from "@/lib/notify";
import { arcTxExplorerUrl } from "@/lib/arcExplorer";
import { fetchContentMeta, fetchFollowStatus, followCreator, unfollowCreator } from "@/lib/platformApi";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useGetMe } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { SignInLink, SignUpLink } from "@/components/AuthLinks";
import { YoutubeEmbed } from "@/components/YoutubeEmbed";
import { isYoutubeMediaUrl } from "@/lib/youtube";

const TYPE_MARKS: Record<string, string> = { article: "✍", audio: "♪", video: "▶" };

export default function ContentDetailPage({ id }: { id: number }) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { authReady, isSignedIn } = useAuthReady();
  const { wallet, activating, ensureReady } = useAppWallet();
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [settlementTx, setSettlementTx] = useState<string | null>(null);
  const [splitTx, setSplitTx] = useState<string | null>(null);

  const { data: content, isLoading } = useGetContent(id, {
    query: { enabled: !!id && authReady, queryKey: getGetContentQueryKey(id) },
  });
  const { data: access } = useCheckContentAccess(id, {
    query: { enabled: !!id && authReady, queryKey: getCheckContentAccessQueryKey(id) },
  });
  const { data: me } = useGetMe();
  const { toast } = useToast();
  const trackView = useTrackContentView();

  const { data: followStatus } = useQuery({
    queryKey: ["follow-status", content?.creatorId],
    queryFn: () => fetchFollowStatus(content!.creatorId),
    enabled: !!content?.creatorId && !!me && me.clerkId !== content.creatorId,
  });

  const subscribeMutation = useMutation({
    mutationFn: () =>
      followStatus?.subscribed
        ? unfollowCreator(content!.creatorId)
        : followCreator(content!.creatorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["follow-status", content?.creatorId] });
      toast({
        title: followStatus?.subscribed
          ? "Unsubscribed"
          : "Subscribed — you'll get email when they publish",
      });
    },
  });

  const { data: seoMeta } = useQuery({
    queryKey: ["seo", id],
    queryFn: () => fetchContentMeta(id),
    enabled: !!content,
  });

  useEffect(() => {
    if (!id) return;
    trackView.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetContentQueryKey(id) });
        },
      },
    );
  }, [id]);

  const handleUnlock = async () => {
    if (!content) return;
    setUnlocking(true);
    setUnlockError(null);
    try {
      await ensureReady();
      const result = await unlockContentWithRetry(id) as {
        txHash?: string | null;
        splitTxHash?: string | null;
        amountPaid?: number;
        alreadyExisted?: boolean;
        alreadyOwned?: boolean;
      };
      if (result.txHash) setSettlementTx(result.txHash);
      if (result.splitTxHash) setSplitTx(result.splitTxHash);

      notifyPaymentSuccess({
        contentTitle: content.title,
        amountPaid: Number(result.amountPaid ?? content.price),
        alreadyOwned: Boolean(result.alreadyOwned ?? result.alreadyExisted),
        splitPending: Boolean((result as { splitPending?: boolean }).splitPending),
        splitTxHash: result.splitTxHash,
      });

      queryClient.invalidateQueries({ queryKey: getCheckContentAccessQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getGetContentQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getGetMyPurchasesQueryKey() });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "reader"] });
      if (content.type === "article") setLocation(`/read/${id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Payment failed";
      const code = (err as Error & { code?: string }).code;
      if (code === "SETTLEMENT_INCOMPLETE") {
        const pendingMsg =
          "Payment received — distributing to the creator on-chain. Wait a moment and tap unlock again (you won't be charged twice).";
        setUnlockError(pendingMsg);
        notifyPaymentPending();
      } else if (message.includes("insufficient") || message.includes("balance") || message.includes("Gateway")) {
        const walletMsg =
          "Your LeptonPad wallet is activating. Wait a few seconds and try again.";
        setUnlockError(walletMsg);
        notifyPaymentFailed(walletMsg);
      } else if (message.includes("Sign in")) {
        setUnlockError(message);
        notifyPaymentFailed(message);
      } else {
        setUnlockError(message);
        notifyPaymentFailed(message);
      }
    } finally {
      setUnlocking(false);
    }
  };

  if (isLoading) {
    return (
      <PlatformLayout>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 animate-pulse">
          <div className="h-2.5 rounded w-1/4 mb-6" style={{ background: "rgba(28,25,23,0.08)" }} />
          <div style={{ borderTop: "1px solid rgba(28,25,23,0.1)", marginBottom: "24px" }} />
          <div className="h-8 rounded w-3/4 mb-3" style={{ background: "rgba(28,25,23,0.08)" }} />
          <div className="h-6 rounded w-1/2 mb-8" style={{ background: "rgba(28,25,23,0.06)" }} />
          <div className="h-40 rounded" style={{ background: "rgba(28,25,23,0.05)" }} />
        </div>
      </PlatformLayout>
    );
  }

  if (!content) {
    return (
      <PlatformLayout>
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <p style={{ color: "#78716C" }}>Content not found.</p>
        </div>
      </PlatformLayout>
    );
  }

  const coverImageUrl = content.coverImageUrl ?? null;
  const creatorVerifiedAtPublish = (content as { creatorVerifiedAtPublish?: boolean | null }).creatorVerifiedAtPublish;
  const isFree = Number(content.price) === 0;
  const hasAccess = access?.hasAccess || isFree || content.hasAccess;
  const accessPending =
    authReady && isSignedIn && access === undefined && !isFree && !content.hasAccess;

  return (
    <PlatformLayout>
      <SeoHead meta={seoMeta ? { title: seoMeta.title, description: seoMeta.description, canonicalUrl: seoMeta.canonicalUrl, image: seoMeta.og?.image as string } : null} />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">

        {/* Back link */}
        <Link href="/feed" className="inline-flex items-center gap-1 mb-8 transition-colors text-xs" style={{ color: "#78716C" }}
          onMouseOver={e => ((e.currentTarget as HTMLElement).style.color = "#1C1917")}
          onMouseOut={e => ((e.currentTarget as HTMLElement).style.color = "#78716C")}
        >
          ← Back to feed
        </Link>

        <ContentCover
          coverImageUrl={coverImageUrl}
          categorySlug={content.categorySlug}
          id={content.id}
          title={content.title}
          aspect="wide"
          rounded
          className="mb-8"
        />

        {/* Section label */}
        <div className="flex items-center gap-2 mb-3">
          <span className="editorial-label" style={{ color: "#78716C" }}>
            {TYPE_MARKS[content.type]} {content.type.charAt(0).toUpperCase() + content.type.slice(1)}
          </span>
          <span style={{ color: "rgba(28,25,23,0.25)", fontSize: "10px" }}>·</span>
          <span className="editorial-label" style={{ color: "#78716C" }}>{content.categoryName}</span>
          {content.readingTimeMinutes && (
            <>
              <span style={{ color: "rgba(28,25,23,0.25)", fontSize: "10px" }}>·</span>
              <span className="editorial-label" style={{ color: "#78716C" }}>{content.readingTimeMinutes} min read</span>
            </>
          )}
          <span style={{ color: "rgba(28,25,23,0.25)", fontSize: "10px" }}>·</span>
          <span className="editorial-label" style={{ color: "#78716C" }}>{content.viewCount} views</span>
        </div>

        {/* Hairline */}
        <div style={{ borderTop: "2px solid #1C1917", marginBottom: "20px" }} />

        {/* Title */}
        <h1
          className="mb-6"
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: "clamp(1.75rem, 5vw, 2.5rem)",
            fontWeight: 700,
            color: "#1C1917",
            lineHeight: 1.25,
          }}
        >
          {content.title}
        </h1>

        {/* Creator byline */}
        <div className="flex items-center gap-3 mb-8 pb-6" style={{ borderBottom: "1px solid rgba(28,25,23,0.12)" }}>
          <Link href={`/creator/${content.creatorId}`}>
          {content.creatorImageUrl ? (
            <img src={content.creatorImageUrl} alt={content.creatorName} className="w-9 h-9 rounded-full object-cover" />
          ) : (
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(28,25,23,0.08)" }}>
              <span style={{ fontSize: "13px", color: "#78716C" }}>{content.creatorName[0]?.toUpperCase()}</span>
            </div>
          )}
          </Link>
          <div className="flex-1">
            <Link href={`/creator/${content.creatorId}`}>
            <p className="text-sm font-semibold hover:underline" style={{ color: "#1C1917" }}>
              <CreatorName name={content.creatorName} verified={content.creatorVerified} size="md" />
            </p>
            </Link>
            <p style={{ fontSize: "12px", color: "#78716C" }}>
              {new Date(content.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          {me?.clerkId === content.creatorId && (
            <Link href={`/edit/${id}`} className="text-xs px-3 py-1.5 rounded" style={{ border: "1px solid rgba(28,25,23,0.15)", color: "#78716C" }}>
              Edit
            </Link>
          )}
          {me && me.clerkId !== content.creatorId && (
            <button
              type="button"
              onClick={() => subscribeMutation.mutate()}
              disabled={subscribeMutation.isPending}
              className="text-xs px-3 py-1.5 rounded font-medium shrink-0"
              style={{
                background: followStatus?.subscribed ? "transparent" : "#1C1917",
                color: followStatus?.subscribed ? "#78716C" : "#FAF7F2",
                border: `1px solid ${followStatus?.subscribed ? "rgba(28,25,23,0.2)" : "#1C1917"}`,
              }}
            >
              {followStatus?.subscribed ? "Subscribed" : "Subscribe"}
            </button>
          )}
        </div>

        {(content as { tags?: string[] }).tags?.length ? (
          <div className="flex flex-wrap gap-2 mb-6">
            {(content as { tags?: string[] }).tags!.map(tag => (
              <Link key={tag} href={`/feed?tag=${tag}`} className="text-xs px-2 py-1 rounded" style={{ background: "rgba(28,25,23,0.06)", color: "#78716C" }}>
                {tag}
              </Link>
            ))}
          </div>
        ) : null}

        {/* Preview excerpt */}
        {content.previewText && (
          <div
            className="mb-8 p-6"
            style={{
              background: "rgba(28,25,23,0.035)",
              border: "1px solid rgba(28,25,23,0.1)",
              borderRadius: "2px",
            }}
          >
            <p className="editorial-label mb-3" style={{ color: "#78716C" }}>Preview</p>
            <p style={{ fontSize: "0.8125rem", color: "#57534E", lineHeight: 1.75, fontFamily: "Georgia, serif" }}>
              {content.previewText}
            </p>
            {content.type === "audio" && content.audioUrl && (
              isYoutubeMediaUrl(content.audioUrl) ? (
                <YoutubeEmbed url={content.audioUrl} title={content.title} className="aspect-video w-full mt-4 overflow-hidden rounded" />
              ) : (
                <audio controls className="w-full mt-4" style={{ accentColor: "#C8960C" }}>
                  <source src={content.audioUrl} />
                </audio>
              )
            )}
            {content.type === "video" && content.videoUrl && (
              isYoutubeMediaUrl(content.videoUrl) ? (
                <YoutubeEmbed url={content.videoUrl} title={content.title} className="aspect-video w-full mt-4 overflow-hidden rounded" />
              ) : (
                <video controls className="w-full mt-4 aspect-video rounded" style={{ background: "#000" }}>
                  <source src={content.videoUrl} />
                </video>
              )
            )}
          </div>
        )}

        {/* Access zone */}
        {!hasAccess && (
          <div className="relative flex items-center gap-4 my-8">
            <div style={{ flex: 1, borderTop: "1px solid rgba(28,25,23,0.12)" }} />
            <span className="editorial-label" style={{ color: "#78716C" }}>Unlock to continue reading</span>
            <div style={{ flex: 1, borderTop: "1px solid rgba(28,25,23,0.12)" }} />
          </div>
        )}

        {/* Paywall or read button */}
        {hasAccess ? (
          <div className="py-8 text-center">
            <p style={{ fontSize: "0.875rem", color: "#78716C", marginBottom: "20px" }}>
              {isFree ? "Free to read — no account required." : "You have access to this piece."}
            </p>
            {(splitTx || settlementTx || access?.paymentId) && (
              <p style={{ fontSize: "11px", color: "#78716C", marginBottom: "16px" }}>
                {splitTx && arcTxExplorerUrl(splitTx) ? (
                  <a href={arcTxExplorerUrl(splitTx)!} target="_blank" rel="noopener noreferrer" style={{ color: "#C8960C" }}>
                    View on-chain split on Arc →
                  </a>
                ) : settlementTx && arcTxExplorerUrl(settlementTx) ? (
                  <a href={arcTxExplorerUrl(settlementTx)!} target="_blank" rel="noopener noreferrer" style={{ color: "#C8960C" }}>
                    View x402 settlement on Arc →
                  </a>
                ) : (
                  "Paid via LeptonSplit on Arc"
                )}
              </p>
            )}
            {content.type === "article" && (
              <Link
                href={`/read/${id}`}
                className="inline-block px-8 py-3 text-sm font-semibold transition-colors"
                style={{ background: "#1C1917", color: "#FAF7F2", borderRadius: "2px" }}
                data-testid="button-read-article"
                onMouseOver={e => ((e.currentTarget as HTMLElement).style.background = "#3C3835")}
                onMouseOut={e => ((e.currentTarget as HTMLElement).style.background = "#1C1917")}
              >
                Read Article →
              </Link>
            )}
            {(content.type === "video" || content.type === "audio") && (
              <Link
                href={`/read/${id}`}
                className="inline-block px-8 py-3 text-sm font-semibold transition-colors"
                style={{ background: "#1C1917", color: "#FAF7F2", borderRadius: "2px" }}
                onMouseOver={e => ((e.currentTarget as HTMLElement).style.background = "#3C3835")}
                onMouseOut={e => ((e.currentTarget as HTMLElement).style.background = "#1C1917")}
              >
                {content.type === "video" ? "Watch →" : "Listen →"}
              </Link>
            )}
          </div>
        ) : accessPending ? (
          <div className="p-8 text-center" style={{ color: "#78716C" }}>
            <p className="text-sm">Checking your library…</p>
          </div>
        ) : (
          <div
            className="p-8 text-center"
            style={{
              background: "#FFFFFF",
              border: "1px solid rgba(28,25,23,0.15)",
              borderRadius: "2px",
            }}
          >
            <p className="editorial-label mb-2" style={{ color: "#78716C" }}>Unlock this {content.type}</p>
            <p className="mb-6 text-sm leading-relaxed" style={{ color: "#57534E" }}>
              You&apos;ve read the preview. Create a free account when you&apos;re ready to unlock the full piece.
            </p>
            <p
              className="mb-1"
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: "3rem",
                fontWeight: 700,
                color: "#C8960C",
                lineHeight: 1,
              }}
              data-testid="text-price-unlock"
            >
              ${Number(content.price).toFixed(Number(content.price) < 0.01 ? 6 : 2)}
            </p>
            <p className="editorial-label mb-8" style={{ color: "#78716C" }}>
              USDC · LeptonPad wallet · Arc · x402 Gateway
            </p>

            <Show when="signed-out">
              <div className="flex flex-col items-center gap-3">
                <SignUpLink
                  returnTo={`/content/${id}`}
                  className="w-full px-10 py-3 text-sm font-semibold transition-colors sm:w-auto"
                  style={{ background: "#1C1917", color: "#FAF7F2", borderRadius: "2px" }}
                >
                  Create free account to unlock
                </SignUpLink>
                <SignInLink returnTo={`/content/${id}`} className="text-sm" style={{ color: "#78716C" }}>
                  Already have an account? Sign in
                </SignInLink>
              </div>
            </Show>

            <Show when="signed-in">
              {wallet?.address && (
                <p style={{ fontSize: "11px", color: "#78716C", marginBottom: "12px", fontFamily: "monospace" }}>
                  LeptonPad wallet {wallet.address.slice(0, 6)}…{wallet.address.slice(-4)}
                  {wallet.gatewayAvailable != null && ` · ${wallet.gatewayAvailable} USDC in Gateway`}
                </p>
              )}

              <button
                onClick={() => void handleUnlock()}
                disabled={unlocking || activating}
                data-testid="button-unlock-content"
                className="px-10 py-3 text-sm font-semibold transition-colors disabled:opacity-60 w-full sm:w-auto"
                style={{ background: "#1C1917", color: "#FAF7F2", borderRadius: "2px" }}
                onMouseOver={e => { if (!unlocking) (e.currentTarget as HTMLElement).style.background = "#3C3835"; }}
                onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = "#1C1917"; }}
              >
                {unlocking || activating
                  ? "Settling on Arc…"
                  : `Pay $${Number(content.price).toFixed(Number(content.price) < 0.01 ? 6 : 2)} USDC`}
              </button>
            </Show>

            <p style={{ fontSize: "11px", color: "#78716C", marginTop: "16px" }}>
              {(creatorVerifiedAtPublish ?? false) ? "100%" : "95%"} goes directly to {content.creatorName}. Settled via Circle Gateway in under 500ms.
            </p>

            {unlockError && (
              <p style={{ color: "#DC2626", fontSize: "0.875rem", marginTop: "12px" }}>{unlockError}</p>
            )}
          </div>
        )}

        <ContentEngagement contentId={id} creatorId={content.creatorId} />
      </div>
    </PlatformLayout>
  );
}
