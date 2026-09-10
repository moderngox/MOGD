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

/** Standby/power glyph — used for the icon-only sign-out control. */
export function PowerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M12 4v7" />
      <path d="M7.5 6.5a7.5 7.5 0 1 0 9 0" />
    </IconBase>
  );
}

/** Admin nav: Dashboard. */
export function DashboardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.25" />
      <rect x="13.5" y="3.5" width="7" height="4.5" rx="1.25" />
      <rect x="13.5" y="11" width="7" height="9.5" rx="1.25" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.25" />
    </IconBase>
  );
}

/** Admin nav: Users. */
export function UsersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20c.9-3.6 3-5.5 5.5-5.5s4.6 1.9 5.5 5.5" />
      <path d="M15.5 8.5a2.75 2.75 0 1 1 0 5.5" />
      <path d="M16 14.6c2.2.4 3.7 2.2 4.4 5.4" />
    </IconBase>
  );
}

/** Admin nav: Media. */
export function MediaIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <rect x="3" y="4.5" width="18" height="14" rx="1.5" />
      <path d="m3 15.5 5-4.5 4 3.5 3.5-3 5.5 4.5" />
      <circle cx="8" cy="9" r="1.5" />
    </IconBase>
  );
}

/** Admin nav: Programs. */
export function ProgramsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <rect x="5" y="3.5" width="14" height="17" rx="1.5" />
      <path d="M9 3.5v-.75a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 .75.75v.75" />
      <path d="M8.5 10h7M8.5 13.5h7M8.5 17h4.5" />
    </IconBase>
  );
}

/** Admin nav: AI Runs. */
export function AiRunsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.5 4.5l2 2M17.5 17.5l2 2M19.5 4.5l-2 2M6.5 17.5l-2 2" />
    </IconBase>
  );
}
