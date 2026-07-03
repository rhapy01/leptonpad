import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { copyContentShareLink, xShareIntentUrl } from "@/lib/shareContent";

type Props = {
  contentId: number;
  title: string;
  className?: string;
};

export function ShareContentButton({ contentId, title, className }: Props) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await copyContentShareLink(contentId);
      setCopied(true);
      toast({ title: "Link copied — rich preview on X & social" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Could not copy link", variant: "destructive" });
    }
  };

  const handleX = () => {
    window.open(xShareIntentUrl(contentId, title), "_blank", "noopener,noreferrer");
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => void handleCopy()}
        className="engagement-btn px-4 py-2 text-sm rounded"
      >
        {copied ? "Copied!" : "Copy link"}
      </button>
      <button
        type="button"
        onClick={handleX}
        className="engagement-btn px-4 py-2 text-sm rounded"
        aria-label="Share on X"
      >
        Share on X
      </button>
    </div>
  );
}
