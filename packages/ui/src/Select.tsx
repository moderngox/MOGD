import type { SelectHTMLAttributes } from "react";
import { cn } from "./cn";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

/** Placeholder primitive — see Button.tsx for why this stays unstyled beyond basics. */
export function Select({ className, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100",
        "focus:border-zinc-400 focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}
