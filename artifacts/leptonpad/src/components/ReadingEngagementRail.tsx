import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useGetMe } from "@workspace/api-client-react";
import {
  fetchCollections,
  fetchReactions,
  fetchComments,
  saveToCollection,
  toggleReaction,
} from "@/lib/platformApi";
import { useToast } from "@/hooks/use-toast";
import { GiftCreatorForm } from "@/components/GiftCreatorForm";

type ReadingEngagementRailProps = {
  contentId: number;
  onComment: () => void;
  onClose: () => void;
  showGift?: boolean;
  creatorId?: string;
  creatorName?: string;
  onGiftSent?: () => void;
  giftPulse?: boolean;
};

function RailIcon({
  label,
  count,
  active,
  onClick,
  pulse,
  children,
}: {
  label: string;
  count?: number;
  active?: boolean;
  pulse?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`reading-rail-btn${active ? " reading-rail-btn--active" : ""}${pulse ? " reading-rail-btn--pulse" : ""}`}
      aria-label={label}
      title={label}
    >
      {children}
      {count !== undefined && <span className="reading-rail-count">{count}</span>}
      <span className="reading-rail-label">{label}</span>
    </button>
  );
}

export function ReadingEngagementRail({
  contentId,
  onComment,
  onClose,
  showGift = false,
  creatorId,
  creatorName,
  onGiftSent,
  giftPulse = false,
}: ReadingEngagementRailProps) {
  const { data: me } = useGetMe();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [giftOpen, setGiftOpen] = useState(false);
  const giftWrapRef = useRef<HTMLDivElement>(null);

  const { data: reactions } = useQuery({
    queryKey: ["reactions", contentId],
    queryFn: () => fetchReactions(contentId),
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["comments", contentId],
    queryFn: () => fetchComments(contentId),
  });

  const { data: collections } = useQuery({
    queryKey: ["collections"],
    queryFn: fetchCollections,
    enabled: !!me,
  });

  const reactionMutation = useMutation({
    mutationFn: () => toggleReaction(contentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reactions", contentId] }),
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const readLater = collections?.find(c => c.slug === "read-later");
      if (!readLater) throw new Error("No collection");
      return saveToCollection(readLater.id, contentId);
    },
    onSuccess: () => toast({ title: "Saved to Read Later" }),
  });

  useEffect(() => {
    if (!giftOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (giftWrapRef.current && !giftWrapRef.current.contains(e.target as Node)) {
        setGiftOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [giftOpen]);

  return (
    <aside className="reading-rail" aria-label="Engagement">
      <RailIcon
        label="Like"
        count={reactions?.count ?? 0}
        active={reactions?.userReacted}
        onClick={() => (me ? reactionMutation.mutate() : toast({ title: "Sign in to like" }))}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill={reactions?.userReacted ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.75">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </RailIcon>

      <RailIcon label="Comment" count={comments.length} onClick={onComment}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </RailIcon>

      <RailIcon
        label="Save"
        onClick={() => (me ? saveMutation.mutate() : toast({ title: "Sign in to save" }))}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      </RailIcon>

      {showGift && creatorId && creatorName && (
        <div className="reading-rail-gift-wrap" ref={giftWrapRef}>
          <RailIcon
            label="Gift"
            active={giftOpen}
            pulse={giftPulse && !giftOpen}
            onClick={() => setGiftOpen((v) => !v)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M20 12v10H4V12" />
              <path d="M2 7h20v5H2z" />
              <path d="M12 22V7" />
              <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
              <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
            </svg>
          </RailIcon>
          {giftOpen && (
            <div className="reading-rail-gift-popover">
              <p className="reading-rail-gift-title">Gift {creatorName}</p>
              <p className="reading-rail-gift-sub">Optional USDC support for this free piece.</p>
              <GiftCreatorForm
                contentId={contentId}
                creatorId={creatorId}
                creatorName={creatorName}
                layout="compact"
                onSuccess={() => {
                  setGiftOpen(false);
                  onGiftSent?.();
                }}
                onCancel={() => setGiftOpen(false)}
              />
            </div>
          )}
        </div>
      )}

      <div className="reading-rail-spacer" />

      <RailIcon label="Close" onClick={onClose}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </RailIcon>
    </aside>
  );
}
