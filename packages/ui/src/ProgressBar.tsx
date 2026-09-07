import { cn } from "./cn";

export type ProgressBarVariant = "accent" | "positive" | "warning" | "caution";

export interface ProgressBarProps {
  value: number;
  max: number;
  variant?: ProgressBarVariant;
  className?: string;
}

const VARIANT_CLASSES: Record<ProgressBarVariant, string> = {
  accent: "bg-accent",
  positive: "bg-status-positive",
  warning: "bg-status-warning",
  caution: "bg-status-caution",
};

/** design.md section 2 (Components) — track/fill bar used for target progress. */
export function ProgressBar({ value, max, variant = "accent", className }: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-1.5 overflow-hidden rounded-full bg-surface-elevated", className)}
    >
      <div className={cn("h-full rounded-full", VARIANT_CLASSES[variant])} style={{ width: `${pct}%` }} />
    </div>
  );
}
