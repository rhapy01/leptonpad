import { useState } from "react";
import { useListContent, useGetMe, checkContentAccess, getCheckContentAccessQueryKey } from "@workspace/api-client-react";
import type { Content } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { resolveCoverUrl } from "@/lib/contentCover";
import { useAppWallet } from "@/hooks/useAppWallet";
import { unlockContentWithRetry } from "@/lib/appWallet";
import {
  notifyPaymentFailed,
  notifyPaymentPending,
  notifyPaymentSuccess,
} from "@/lib/notify";
import { toast } from "@/hooks/use-toast";

type ReadingSidebarMoreProps = {
  currentId: number;
  creatorId: string;
  creatorName: string;
  onStartReading: (contentId: number) => void;
};

export function ReadingSidebarMore({
  currentId,
  creatorId,
  creatorName,
  onStartReading,
}: ReadingSidebarMoreProps) {
  const { data: me } = useGetMe();
  const queryClient = useQueryClient();
  const { ensureReady } = useAppWallet();
  const [payTarget, setPayTarget] = useState<Content | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const { data: feed } = useListContent({
    creatorId,
    limit: 8,
  });

  const moreItems = (feed?.items ?? [])
    .filter(item => item.id !== currentId)
    .slice(0, 2);

  if (moreItems.length === 0) return null;

  const openItem = async (item: Content) => {
    setUnlockError(null);
    const isFree = Number(item.price) === 0;
    if (isFree) {
      onStartReading(item.id);
      return;
    }

    try {
      const access = await checkContentAccess(item.id);
      if (access.hasAccess) {
        onStartReading(item.id);
        return;
      }
    } catch {
      toast({ title: "Could not check access", variant: "destructive" });
      return;
    }

    if (!me) {
      toast({ title: "Sign in to unlock paid content" });
      return;
    }

    setPayTarget(item);
  };

  const handleUnlock = async () => {
    if (!payTarget) return;
    setUnlocking(true);
    setUnlockError(null);
    try {
      await ensureReady();
      const result = await unlockContentWithRetry(payTarget.id) as {
        amountPaid?: number;
        alreadyExisted?: boolean;
        alreadyOwned?: boolean;
      };
      queryClient.invalidateQueries({ queryKey: getCheckContentAccessQueryKey(payTarget.id) });
      const unlockedId = payTarget.id;
      setPayTarget(null);
      onStartReading(unlockedId);
      notifyPaymentSuccess({
        contentTitle: payTarget.title,
        amountPaid: Number(result.amountPaid ?? payTarget.price),
        alreadyOwned: Boolean(result.alreadyOwned ?? result.alreadyExisted),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Payment failed";
      const code = (err as Error & { code?: string }).code;
      setUnlockError(message);
      if (code === "SETTLEMENT_INCOMPLETE") {
        notifyPaymentPending();
      } else {
        notifyPaymentFailed(message);
      }
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <div className="reading-sidebar-more">
      <p className="reading-sidebar-more-heading">More from {creatorName}</p>

      {payTarget && (
        <div className="reading-sidebar-pay">
          <p className="reading-sidebar-pay-title">{payTarget.title}</p>
          <p className="reading-sidebar-pay-price">
            ${Number(payTarget.price).toFixed(4)} USDC
          </p>
          {unlockError && (
            <p className="reading-sidebar-pay-error">{unlockError}</p>
          )}
          <div className="reading-sidebar-pay-actions">
            <button
              type="button"
              className="reading-sidebar-pay-btn"
              onClick={() => void handleUnlock()}
              disabled={unlocking}
            >
              {unlocking ? "Unlocking…" : "Unlock & read"}
            </button>
            <button
              type="button"
              className="reading-sidebar-pay-cancel"
              onClick={() => { setPayTarget(null); setUnlockError(null); }}
              disabled={unlocking}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <ul className="reading-sidebar-more-list">
        {moreItems.map(item => {
          const thumb = resolveCoverUrl(item.coverImageUrl, item.categorySlug, item.id);
          const isFree = Number(item.price) === 0;
          return (
            <li key={item.id}>
              <button
                type="button"
                className="reading-sidebar-more-item"
                onClick={() => void openItem(item)}
                disabled={!!payTarget && payTarget.id !== item.id}
              >
                <img src={thumb} alt="" className="reading-sidebar-more-thumb" />
                <span className="reading-sidebar-more-info">
                  <span className="reading-sidebar-more-title">{item.title}</span>
                  <span className="reading-sidebar-more-meta">
                    {isFree ? "Free" : `$${Number(item.price).toFixed(2)} USDC`}
                    {" · "}{item.type}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
