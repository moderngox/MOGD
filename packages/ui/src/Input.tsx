import type { InputHTMLAttributes } from "react";
import { cn } from "./cn";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

/** design.md section 2 (Components). */
export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg",
        "placeholder:text-fg-secondary focus:border-accent focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}
