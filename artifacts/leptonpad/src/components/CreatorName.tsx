import type { CSSProperties, ReactNode } from "react";
import { VerifiedBadge } from "@/components/VerifiedBadge";

type CreatorNameProps = {
  name: string;
  verified?: boolean;
  dark?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

export function CreatorName({
  name,
  verified,
  dark,
  size = "sm",
  className,
  style,
  children,
}: CreatorNameProps) {
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        flexDirection: "row",
        alignItems: "center",
        gap: "4px",
        minWidth: 0,
        ...style,
      }}
    >
      <span className="truncate">{name}</span>
      {verified ? <VerifiedBadge dark={dark} size={size} /> : null}
      {children}
    </span>
  );
}
