export interface SparklineProps {
  points: number[];
  width?: number;
  height?: number;
  className?: string;
}

/**
 * design.md section 2 (Components). Dependency-free inline SVG line —
 * no chart library is installed, and one static trend line doesn't
 * justify adding one (see design.md's note on this tradeoff).
 */
export function Sparkline({ points, width = 240, height = 56, className }: SparklineProps) {
  if (points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const coords = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = height - ((p - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      className={className}
      aria-hidden="true"
    >
      <polyline
        points={coords}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
