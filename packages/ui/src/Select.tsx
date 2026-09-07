import type { SelectHTMLAttributes } from "react";
import { cn } from "./cn";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

/** design.md section 2 (Components). */
export function Select({ className, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg",
        "focus:border-accent focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}
