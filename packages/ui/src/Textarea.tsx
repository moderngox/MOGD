import type { TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

/** design.md section 2 (Components). */
export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        "rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg",
        "placeholder:text-fg-secondary focus:border-accent focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}
