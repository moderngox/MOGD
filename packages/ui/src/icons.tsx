import type { ReactNode, SVGProps } from "react";

/**
 * Dependency-free inline SVG icons (same rationale as Sparkline: one small
 * icon set doesn't justify an icon-library dependency). Stroke-only, 24x24,
 * currentColor — so they inherit whatever text color a nav item applies.
 */
function IconBase({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function HomeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" />
      <path d="M10 20v-6h4v6" />
    </IconBase>
  );
}

export function DumbbellIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <rect x="4.5" y="8" width="3" height="8" rx="1" />
      <rect x="16.5" y="8" width="3" height="8" rx="1" />
      <path d="M3 10.5v3M21 10.5v3" />
      <path d="M7.5 12h9" />
    </IconBase>
  );
}

export function AppleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M12 7.5c-2.8-2.2-7-.6-7 4.3 0 4.5 3.1 8.7 6 8.7.6 0 1-.2 1-.2s.4.2 1 .2c2.9 0 6-4.2 6-8.7 0-4.9-4.2-6.5-7-4.3Z" />
      <path d="M12 7.5V5" />
      <path d="M12 5c.5-1.1 1.9-1.7 3.2-1.3" />
    </IconBase>
  );
}

export function ProgressIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M4 20v-6M11 20V9M18 20v-9" />
      <path d="M3 20h18" />
    </IconBase>
  );
}
