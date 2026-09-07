import type { InputHTMLAttributes } from "react";
import { cn } from "./cn";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
}

/** design.md section 2 (Components). */
export function Checkbox({ label, className, id, ...props }: CheckboxProps) {
  return (
    <label
      htmlFor={id}
      className={cn("flex items-center gap-2 text-sm text-fg-secondary-alt", className)}
    >
      <input
        type="checkbox"
        id={id}
        className="h-4 w-4 rounded border-border-strong bg-surface accent-accent"
        {...props}
      />
      {label}
    </label>
  );
}
