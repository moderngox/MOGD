import type { InputHTMLAttributes } from "react";
import { cn } from "./cn";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
}

/** Placeholder primitive — see Button.tsx for why this stays unstyled beyond basics. */
export function Checkbox({ label, className, id, ...props }: CheckboxProps) {
  return (
    <label
      htmlFor={id}
      className={cn("flex items-center gap-2 text-sm text-zinc-200", className)}
    >
      <input
        type="checkbox"
        id={id}
        className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 accent-zinc-100"
        {...props}
      />
      {label}
    </label>
  );
}
