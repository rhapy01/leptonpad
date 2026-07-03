import { GiftCreatorForm } from "@/components/GiftCreatorForm";

type Props = {
  contentId: number;
  creatorName: string;
  creatorId: string;
  onDismiss: () => void;
  onGiftSent: () => void;
};

/** Substack-style mid-read prompt for free articles (~halfway through). */
export function ReadingGiftPrompt({
  contentId,
  creatorName,
  creatorId,
  onDismiss,
  onGiftSent,
}: Props) {
  return (
    <aside className="reading-gift-prompt" role="dialog" aria-label="Support the creator">
      <button
        type="button"
        className="reading-gift-prompt-close"
        aria-label="Dismiss"
        onClick={onDismiss}
      >
        ×
      </button>
      <p className="reading-gift-prompt-kicker">Free article</p>
      <p className="reading-gift-prompt-title">Enjoying this? Support the creator.</p>
      <p className="reading-gift-prompt-body">
        {creatorName} published this for free. Send an optional USDC gift — settled on Arc like a paid unlock.
      </p>
      <GiftCreatorForm
        contentId={contentId}
        creatorId={creatorId}
        creatorName={creatorName}
        layout="compact"
        onSuccess={() => {
          onGiftSent();
          onDismiss();
        }}
        onCancel={onDismiss}
      />
    </aside>
  );
}
