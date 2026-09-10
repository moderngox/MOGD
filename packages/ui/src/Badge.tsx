import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export type BadgeVariant = "current" | "positive" | "neutral" | "caution" | "warning" | "info";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  current: "bg-accent text-bg",
  positive: "border border-status-positive/40 bg-status-positive/15 text-status-positive",
  neutral: "border border-border text-fg-secondary",
  caution: "border border-status-caution/40 bg-status-caution/15 text-status-caution",
  warning: "border border-status-warning/40 bg-status-warning/15 text-status-warning",
  info: "border border-status-info/40 bg-status-info/15 text-status-info",
};

/** design.md section 2 (Components) — status pill: LOGGED/TODAY/SCHEDULED and similar. */
export function Badge({ variant = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    />
  );
}
