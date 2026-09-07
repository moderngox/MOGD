import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

/**
 * Placeholder primitive. design.md has no finalized token/typography/color
 * spec yet — this uses plain Tailwind neutrals so functionality (forms,
 * flows) can be built now without asserting a visual system that would need
 * to be thrown away. Replace styling here once the full design spec lands.
 */
export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50",
        variant === "primary"
          ? "bg-zinc-100 text-zinc-950 hover:bg-white"
          : "bg-zinc-800 text-zinc-100 hover:bg-zinc-700",
        className,
      )}
      {...props}
    />
  );
}
