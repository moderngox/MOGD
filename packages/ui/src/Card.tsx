import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  eyebrow?: ReactNode;
}

/** design.md section 2 (Components). */
export function Card({ title, eyebrow, className, children, ...props }: CardProps) {
  return (
    <div className={cn("flex flex-col gap-3.5 rounded-lg border border-border bg-surface p-5", className)} {...props}>
      {(title || eyebrow) && (
        <div className="flex items-baseline justify-between gap-3">
          {title && <h2 className="text-lg font-semibold text-fg">{title}</h2>}
          {eyebrow && <span className="text-xs text-fg-secondary">{eyebrow}</span>}
        </div>
      )}
      {children}
    </div>
  );
}
