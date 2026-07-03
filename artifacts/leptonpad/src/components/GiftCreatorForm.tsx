import { useState } from "react";
import { Show } from "@clerk/react";
import { giftCreator } from "@/lib/platformApi";
import { useAppWallet } from "@/hooks/useAppWallet";
import { notifyGiftSuccess, notifyPaymentFailed } from "@/lib/notify";
import { SignInLink } from "@/components/AuthLinks";

export const GIFT_PRESETS = [0.05, 0.1, 0.25] as const;

export type GiftCreatorFormProps = {
  contentId: number;
  creatorId: string;
  creatorName: string;
  layout?: "default" | "compact";
  onSuccess?: () => void;
  onCancel?: () => void;
};

export function GiftCreatorForm({
  contentId,
  creatorId,
  creatorName,
  layout = "default",
  onSuccess,
  onCancel,
}: GiftCreatorFormProps) {
  const { activating, ensureReady } = useAppWallet();
  const [amount, setAmount] = useState<number>(0.1);
  const [customAmount, setCustomAmount] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const resolvedAmount = customAmount.trim()
    ? Number.parseFloat(customAmount)
    : amount;

  const sendGift = async () => {
    if (!Number.isFinite(resolvedAmount) || resolvedAmount <= 0) {
      notifyPaymentFailed("Enter a valid gift amount.");
      return;
    }

    setBusy(true);
    try {
      await ensureReady();
      const result = await giftCreator({
        toCreatorId: creatorId,
        amount: resolvedAmount,
        contentId,
        message: message.trim() || undefined,
      });
      notifyGiftSuccess({
        creatorName,
        amount: result.amount,
        creatorShare: result.creatorShare,
      });
      setMessage("");
      setCustomAmount("");
      onSuccess?.();
    } catch (e) {
      notifyPaymentFailed(e instanceof Error ? e.message : "Gift could not be sent");
    } finally {
      setBusy(false);
    }
  };

  const compact = layout === "compact";

  return (
    <div className={compact ? "reading-gift-form reading-gift-form--compact" : "reading-gift-form"}>
      <Show when="signed-in">
        <div className="reading-gift-presets">
          {GIFT_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={busy}
              onClick={() => {
                setAmount(preset);
                setCustomAmount("");
              }}
              className={`reading-gift-preset${!customAmount && amount === preset ? " reading-gift-preset--active" : ""}`}
            >
              ${preset.toFixed(2)}
            </button>
          ))}
          <input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Custom"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            className="reading-gift-custom"
          />
        </div>
        {!compact && (
          <input
            type="text"
            placeholder="Add a note (optional)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={200}
            className="reading-gift-note"
          />
        )}
        <div className="reading-gift-actions">
          <button
            type="button"
            disabled={busy || activating}
            onClick={() => void sendGift()}
            className="reading-gift-send"
          >
            {busy || activating ? "Sending…" : `Gift $${Number.isFinite(resolvedAmount) ? resolvedAmount.toFixed(2) : "0.00"}`}
          </button>
          {onCancel && (
            <button type="button" disabled={busy} onClick={onCancel} className="reading-gift-cancel">
              Not now
            </button>
          )}
        </div>
      </Show>
      <Show when="signed-out">
        <p className="reading-gift-signin">
          <SignInLink className="underline font-medium" /> to gift from your wallet.
        </p>
      </Show>
    </div>
  );
}
