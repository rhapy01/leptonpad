import { useState } from "react";
import { useLocation } from "wouter";
import { useListCategories, useUpdateMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0D0F14" }}>
        <div className="w-8 h-8 border-2 border-[#F5C842] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16" style={{ background: "#0D0F14" }}>
      <div className="max-w-2xl w-full">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 rounded-full border border-[#F5C842]/60 flex items-center justify-center">
              <span className="font-serif text-[#F5C842] text-xl font-bold" style={{ fontFamily: "Georgia, serif" }}>λ</span>
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold text-[#E8EAF0] mb-3 leading-tight">
            What do you want to see on LeptonPad?
          </h1>
          <p className="text-[#6B7280] text-base">
            Select the categories you care about. Your feed shows only what you choose.
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
                  background: isSelected ? "rgba(245,200,66,0.06)" : "#161820",
                  borderColor: isSelected ? "#F5C842" : "rgba(255,255,255,0.08)",
                  animationDelay: `${i * 60}ms`,
                  animation: "cardEntrance 0.4s ease forwards",
                }}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl shrink-0 mt-0.5" style={{ fontFamily: "monospace" }}>
                    {CATEGORY_ICONS[cat.slug] ?? "◆"}
                  </span>
                  <div>
                    <p className={`font-semibold mb-1 transition-colors ${isSelected ? "text-[#F5C842]" : "text-[#E8EAF0]"}`}>
                      {cat.name}
                    </p>
                    <p className="text-sm text-[#6B7280]">{cat.description}</p>
                  </div>
                </div>
                {isSelected && (
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#F5C842] flex items-center justify-center">
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="#0D0F14" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="text-center">
          <button
            onClick={handleContinue}
            disabled={selected.length === 0 || updateMe.isPending}
            data-testid="button-continue-onboarding"
            className="px-10 py-3.5 rounded-lg font-semibold text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: selected.length > 0 ? "#F5C842" : "#2A2C35",
              color: selected.length > 0 ? "#0D0F14" : "#6B7280",
            }}
          >
            {updateMe.isPending ? "Saving..." : `Continue${selected.length > 0 ? ` (${selected.length} selected)` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
