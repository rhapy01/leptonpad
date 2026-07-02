import { useState } from "react";
import { useLocation } from "wouter";
import { useListCategories, useUpdateMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { FocusPageLayout } from "@/components/FocusPageLayout";

const CATEGORY_ICONS: Record<string, string> = {
  "crypto-web3": "₿",
  "music-audio": "♪",
  "independent-writing": "✍",
  "video-film": "▶",
  "tech-development": "</>",
};

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const [selected, setSelected] = useState<string[]>([]);
  const { data: categories, isLoading } = useListCategories();
  const updateMe = useUpdateMe();
  const queryClient = useQueryClient();

  const toggle = (slug: string) => {
    setSelected(prev =>
      prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]
    );
  };

  const handleContinue = async () => {
    if (selected.length === 0) return;
    await updateMe.mutateAsync({ data: { selectedCategories: selected, onboardingComplete: true } });
    queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    setLocation("/feed");
  };

  const handleSkip = async () => {
    await updateMe.mutateAsync({ data: { onboardingComplete: true } });
    queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    setLocation("/feed");
  };

  if (isLoading) {
    return (
      <FocusPageLayout wide backHref="/feed" backLabel="← Skip to feed">
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "#1C1917", borderTopColor: "transparent" }} />
        </div>
      </FocusPageLayout>
    );
  }

  return (
    <FocusPageLayout wide backHref="/feed" backLabel="← Skip to feed">
    <div className="w-full">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 rounded-full border flex items-center justify-center" style={{ borderColor: "rgba(28,25,23,0.3)" }}>
              <span className="text-xl font-bold" style={{ fontFamily: "Georgia, serif", color: "#1C1917" }}>λ</span>
            </div>
          </div>
          <h1
            className="mb-3 text-3xl font-semibold leading-tight sm:text-4xl"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1C1917" }}
          >
            Personalize your feed
          </h1>
          <p className="text-base" style={{ color: "#78716C" }}>
            Optional — pick categories you care about, or skip and browse everything.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
          {categories?.map((cat, i) => {
            const isSelected = selected.includes(cat.slug);
            return (
              <button
                key={cat.slug}
                onClick={() => toggle(cat.slug)}
                data-testid={`tile-category-${cat.slug}`}
                className="relative p-5 rounded-xl border-2 text-left transition-all duration-200 cursor-pointer"
                style={{
                  background: isSelected ? "rgba(28,25,23,0.04)" : "#FFFFFF",
                  borderColor: isSelected ? "#1C1917" : "rgba(28,25,23,0.12)",
                  animationDelay: `${i * 60}ms`,
                  animation: "cardEntrance 0.4s ease forwards",
                }}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl shrink-0 mt-0.5" style={{ fontFamily: "monospace" }}>
                    {CATEGORY_ICONS[cat.slug] ?? "◆"}
                  </span>
                  <div>
                    <p className={`font-semibold mb-1 transition-colors ${isSelected ? "text-[#1C1917]" : "text-[#1C1917]"}`}>
                      {cat.name}
                    </p>
                    <p className="text-sm" style={{ color: "#78716C" }}>{cat.description}</p>
                  </div>
                </div>
                {isSelected && (
                  <div className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full" style={{ background: "#1C1917" }}>
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="#FAF7F2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={handleContinue}
            disabled={selected.length === 0 || updateMe.isPending}
            data-testid="button-continue-onboarding"
            className="px-10 py-3.5 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              background: selected.length > 0 ? "#1C1917" : "rgba(28,25,23,0.08)",
              color: selected.length > 0 ? "#FAF7F2" : "#78716C",
              borderRadius: "2px",
            }}
          >
            {updateMe.isPending ? "Saving..." : `Save preferences${selected.length > 0 ? ` (${selected.length})` : ""}`}
          </button>
          <button
            type="button"
            onClick={() => void handleSkip()}
            disabled={updateMe.isPending}
            className="px-6 py-3.5 text-sm font-medium"
            style={{ color: "#78716C" }}
          >
            Skip for now
          </button>
        </div>
    </div>
    </FocusPageLayout>
  );
}
