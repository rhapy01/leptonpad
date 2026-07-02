type VerifiedBadgeProps = {
  dark?: boolean;
  size?: "sm" | "md" | "lg";
  title?: string;
};

const SIZES = {
  sm: { width: "12px", height: "12px", fontSize: "7px" },
  md: { width: "14px", height: "14px", fontSize: "8px" },
  lg: { width: "18px", height: "18px", fontSize: "10px" },
};

export function VerifiedBadge({
  dark,
  size = "md",
  title = "Verified creator — keeps 100% of sales",
}: VerifiedBadgeProps) {
  const dims = SIZES[size];
  return (
    <span
      title={title}
      aria-label="Verified creator"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: dims.width,
        height: dims.height,
        borderRadius: "50%",
        background: dark ? "#F5C842" : "#C8960C",
        color: dark ? "#1C1917" : "#fff",
        fontSize: dims.fontSize,
        fontWeight: 700,
        flexShrink: 0,
        verticalAlign: "middle",
      }}
    >
      ✓
    </span>
  );
}
