import type { InputHTMLAttributes } from "react";
import { cn } from "./cn";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

/** Placeholder primitive — see Button.tsx for why this stays unstyled beyond basics. */
export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100",
        "placeholder:text-zinc-500 focus:border-zinc-400 focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}
