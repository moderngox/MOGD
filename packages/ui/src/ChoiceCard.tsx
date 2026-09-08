import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

export type ChoiceCardVariant = "block" | "pill";

export interface ChoiceCardProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onSelect"> {
  label: string;
  description?: string;
  selected: boolean;
  onSelect: () => void;
  variant?: ChoiceCardVariant;
  role?: "radio" | "checkbox";
}

/**
 * Selectable option — design.md's "card/chip language" for the assessment
 * wizard (design.md section 3, Onboarding). `variant="block"` is a
 * full-width descriptive card; `variant="pill"` is a compact inline toggle.
 * Callers own selection state and group semantics (wrap a set of these in
 * role="radiogroup" for single-select, or role="group" for multi-select).
 */
export function ChoiceCard({
  label,
  description,
  selected,
  onSelect,
  variant = "block",
  role = "checkbox",
  className,
  disabled,
  ...props
}: ChoiceCardProps) {
  const base = cn(
    "border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-40",
    selected
      ? "border-accent bg-accent/10 text-fg"
      : "border-border bg-surface text-fg-secondary-alt hover:border-border-strong",
  );

  if (variant === "pill") {
    return (
      <button
        type="button"
        role={role}
        aria-checked={selected}
        onClick={onSelect}
        disabled={disabled}
        className={cn(base, "rounded-full px-4 py-2 text-sm font-medium", className)}
        {...props}
      >
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      aria-label={label}
      onClick={onSelect}
      disabled={disabled}
      className={cn(base, "flex flex-col gap-0.5 rounded-lg px-4 py-3", className)}
      {...props}
    >
      <span className="text-sm font-semibold" aria-hidden="true">
        {label}
      </span>
      {description && (
        <span className="text-xs text-fg-secondary" aria-hidden="true">
          {description}
        </span>
      )}
    </button>
  );
}
