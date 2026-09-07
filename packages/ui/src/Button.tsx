import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "outline" | "destructive";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-accent text-bg hover:bg-accent-hover",
  secondary: "bg-surface-elevated text-fg border border-border hover:border-border-strong",
  outline: "bg-transparent text-fg border border-border hover:border-border-strong",
  destructive: "bg-transparent text-status-warning border border-status-warning hover:bg-status-warning/10",
};

/**
 * Design system: see design.md section 2 (Components). The mockup pairs a
 * filled accent CTA with an outline CTA side by side, which "primary" and
 * "secondary" alone couldn't express — hence a distinct "outline" variant.
 */
export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50",
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    />
  );
}
