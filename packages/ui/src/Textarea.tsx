import type { TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

/** Placeholder primitive — see Button.tsx for why this stays unstyled beyond basics. */
export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        "rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100",
        "placeholder:text-zinc-500 focus:border-zinc-400 focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}
