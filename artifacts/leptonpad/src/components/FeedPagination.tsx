interface FeedPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function FeedPagination({ page, pageSize, total, onPageChange }: FeedPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const pages = buildPageList(page, totalPages);

  return (
    <nav
      className="flex items-center justify-center gap-1 pt-10 pb-4"
      aria-label="Feed pagination"
    >
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="px-3 py-1.5 text-xs transition-colors disabled:opacity-40"
        style={{ color: "#78716C", border: "1px solid rgba(28,25,23,0.15)", borderRadius: "2px" }}
      >
        ← Prev
      </button>

      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`ellipsis-${i}`} className="px-2 text-xs" style={{ color: "#78716C" }}>
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            className="min-w-[2rem] px-2 py-1.5 text-xs transition-colors"
            style={{
              color: p === page ? "#FAF7F2" : "#78716C",
              background: p === page ? "#1C1917" : "transparent",
              border: `1px solid ${p === page ? "#1C1917" : "rgba(28,25,23,0.15)"}`,
              borderRadius: "2px",
              fontWeight: p === page ? 600 : 400,
            }}
          >
            {p}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="px-3 py-1.5 text-xs transition-colors disabled:opacity-40"
        style={{ color: "#78716C", border: "1px solid rgba(28,25,23,0.15)", borderRadius: "2px" }}
      >
        Next →
      </button>
    </nav>
  );
}

function buildPageList(current: number, total: number): Array<number | "…"> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: Array<number | "…"> = [1];
  if (current > 3) pages.push("…");

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let p = start; p <= end; p++) pages.push(p);

  if (current < total - 2) pages.push("…");
  pages.push(total);
  return pages;
}
