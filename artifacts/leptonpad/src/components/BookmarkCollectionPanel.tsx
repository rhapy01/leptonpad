import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchCollectionItems,
  fetchCollections,
  removeFromCollection,
  type CollectionItem,
} from "@/lib/platformApi";
import { ContentCover } from "@/components/ContentCover";

type Tab = "read-later" | "favorites";

export function BookmarkCollectionPanel() {
  const [tab, setTab] = useState<Tab>("read-later");
  const qc = useQueryClient();

  const { data: collections } = useQuery({
    queryKey: ["collections"],
    queryFn: fetchCollections,
  });

  const active = collections?.find((c) => c.slug === tab);
  const collectionId = active?.id;

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["collection-items", collectionId],
    queryFn: () => fetchCollectionItems(collectionId!),
    enabled: !!collectionId,
  });

  const unsave = useMutation({
    mutationFn: (contentId: number) => removeFromCollection(collectionId!, contentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collection-items", collectionId] });
      qc.invalidateQueries({ queryKey: ["collections"] });
    },
  });

  return (
    <section>
      <div className="flex flex-wrap gap-2 mb-6">
        {(
          [
            { slug: "read-later" as const, label: "Read later" },
            { slug: "favorites" as const, label: "Favorites" },
          ] as const
        ).map((t) => (
          <button
            key={t.slug}
            type="button"
            onClick={() => setTab(t.slug)}
            className="px-3 py-1.5 text-xs font-semibold transition-colors"
            style={{
              background: tab === t.slug ? "#1C1917" : "#FFFFFF",
              color: tab === t.slug ? "#FFFFFF" : "#57534E",
              border: "1px solid rgba(28,25,23,0.15)",
            }}
          >
            {t.label}
            {collections?.find((c) => c.slug === t.slug)?.itemCount
              ? ` (${collections.find((c) => c.slug === t.slug)!.itemCount})`
              : ""}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p style={{ color: "#78716C" }}>Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm" style={{ color: "#78716C" }}>
          Nothing saved yet. Tap <strong>Save</strong> on any piece while reading to add it here.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {items.map((item) => (
            <BookmarkCard
              key={item.id}
              item={item}
              onRemove={() => unsave.mutate(item.id)}
              removing={unsave.isPending}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function BookmarkCard({
  item,
  onRemove,
  removing,
}: {
  item: CollectionItem;
  onRemove: () => void;
  removing: boolean;
}) {
  return (
    <article
      className="overflow-hidden"
      style={{ background: "#FFFFFF", border: "1px solid rgba(28,25,23,0.1)" }}
    >
      <Link href={`/read/${item.id}`}>
        <ContentCover
          coverImageUrl={item.coverImageUrl}
          categorySlug={item.categorySlug}
          id={item.id}
          title={item.title}
          size="compact"
          className="w-full object-cover"
        />
      </Link>
      <div className="p-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/read/${item.id}`}>
            <h3 className="text-sm font-medium hover:underline line-clamp-2" style={{ color: "#1C1917" }}>
              {item.title}
            </h3>
          </Link>
          <p className="text-xs mt-1 capitalize" style={{ color: "#78716C" }}>
            {item.type}
            {item.price > 0 ? ` · $${item.price.toFixed(2)}` : " · Free"}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          disabled={removing}
          className="text-xs shrink-0 hover:underline"
          style={{ color: "#78716C" }}
        >
          Remove
        </button>
      </div>
    </article>
  );
}
