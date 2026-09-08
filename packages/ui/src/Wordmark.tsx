import { cn } from "./cn";

export interface WordmarkProps {
  href?: string;
  className?: string;
  /** "compact" is for the mobile top bar; "default" is the sidebar's larger treatment. */
  size?: "default" | "compact";
}

/** MOGᴰ wordmark + accent underline. Shared by `SidebarNav` and the mobile top bar. */
export function Wordmark({ href = "/dashboard", className, size = "default" }: WordmarkProps) {
  const compact = size === "compact";
  return (
    <a
      href={href}
      aria-label="MOGD home"
      className={cn("inline-flex flex-col items-start", compact ? "gap-1.5" : "gap-3", className)}
    >
      <span
        className={cn(
          "inline-flex items-start font-display tracking-[.18em] text-fg",
          compact ? "text-xl" : "text-3xl",
        )}
      >
        MOG<span className={cn("ml-[-3px] leading-none", compact ? "text-sm" : "text-base")}>D</span>
      </span>
      <span aria-hidden="true" className={cn("block h-0.5 bg-accent", compact ? "w-5" : "w-7")} />
    </a>
  );
}
