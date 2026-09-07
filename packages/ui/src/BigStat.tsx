import type { ReactNode } from "react";
import { cn } from "./cn";

export interface BigStatProps {
  label: ReactNode;
  value: ReactNode;
  target?: ReactNode;
  unit?: ReactNode;
  note?: ReactNode;
  className?: string;
}

/** design.md section 2 (Components) — Barlow Condensed value + Inter label, used for hero numbers. */
export function BigStat({ label, value, target, unit, note, className }: BigStatProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-fg-secondary-alt">{label}</span>
        <span className="whitespace-nowrap font-display text-2xl font-semibold tabular-nums text-fg">
          {value}
          {target == null && unit && <span className="ml-1 text-sm font-normal text-fg-secondary">{unit}</span>}
          {target != null && (
            <span className="ml-1 text-sm font-normal tabular-nums text-fg-secondary">
              / {target}
              {unit ? ` ${unit}` : ""}
            </span>
          )}
        </span>
      </div>
      {note && <span className="text-xs text-fg-secondary">{note}</span>}
    </div>
  );
}
