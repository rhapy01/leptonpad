import { useState } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { PurchasedCollectionPanel } from "@/components/PurchasedCollectionPanel";
import { BookmarkCollectionPanel } from "@/components/BookmarkCollectionPanel";
import { SettlementRailPanel } from "@/components/SettlementRailPanel";

type Tab = "unlocked" | "saved";

export default function CollectionsPage() {
  const [tab, setTab] = useState<Tab>("unlocked");

  return (
    <DashboardShell
      title="Collection"
      subtitle="Unlocked pieces and saved bookmarks — read anytime."
    >
      <SettlementRailPanel variant="public" />

      <div className="flex flex-wrap gap-2 mb-8 border-b pb-4" style={{ borderColor: "rgba(28,25,23,0.1)" }}>
        {(
          [
            { id: "unlocked" as const, label: "Unlocked" },
            { id: "saved" as const, label: "Saved" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className="pb-2 text-sm font-semibold transition-colors"
            style={{
              color: tab === t.id ? "#1C1917" : "#78716C",
              borderBottom: tab === t.id ? "2px solid #C8960C" : "2px solid transparent",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "unlocked" ? <PurchasedCollectionPanel /> : <BookmarkCollectionPanel />}
    </DashboardShell>
  );
}
