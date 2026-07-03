import { GiftCreatorForm } from "@/components/GiftCreatorForm";

type Props = {
  contentId: number;
  contentTitle: string;
  creatorId: string;
  creatorName: string;
};

/** Full-width gift panel for the content detail page (free articles). */
export function GiftArticlePanel({ contentId, creatorId, creatorName }: Props) {
  return (
    <div className="gift-article-panel">
      <p className="editorial-label mb-1" style={{ color: "#92400E" }}>Gift</p>
      <p className="text-sm mb-4" style={{ color: "#57534E", lineHeight: 1.6 }}>
        This piece is free to read. If it resonated, gift {creatorName} in USDC — optional support, settled on Arc.
      </p>
      <GiftCreatorForm
        contentId={contentId}
        creatorId={creatorId}
        creatorName={creatorName}
      />
    </div>
  );
}
