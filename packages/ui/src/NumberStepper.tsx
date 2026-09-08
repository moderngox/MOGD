export interface NumberStepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  id?: string;
}

const TICK_COUNT = 20;

/**
 * Big-number stepper + range slider for the assessment's numeric fields
 * (design.md section 3, Onboarding "card/chip language"). Tick marks are a
 * decorative scale, not aligned to every discrete slider value.
 */
export function NumberStepper({ label, value, onChange, min, max, step = 1, unit, id }: NumberStepperProps) {
  function clamp(next: number) {
    onChange(Math.min(max, Math.max(min, next)));
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-fg-secondary-alt">
        {label}
      </label>
      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => clamp(value - step)}
          disabled={value <= min}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border-strong text-fg transition-colors hover:border-accent disabled:opacity-40"
        >
          −
        </button>
        <span className="min-w-24 text-center font-display text-3xl font-semibold tabular-nums text-fg">
          {value}
          {unit && <span className="ml-1 font-sans text-base font-normal text-fg-secondary">{unit}</span>}
        </span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => clamp(value + step)}
          disabled={value >= max}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border-strong text-fg transition-colors hover:border-accent disabled:opacity-40"
        >
          +
        </button>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => clamp(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-elevated accent-accent"
      />
      <div className="flex justify-between px-0.5" aria-hidden="true">
        {Array.from({ length: TICK_COUNT }).map((_, i) => (
          <span key={i} className="h-1.5 w-px bg-border" />
        ))}
      </div>
      <div className="flex justify-between text-xs text-fg-muted">
        <span>
          {min}
          {unit ? ` ${unit}` : ""}
        </span>
        <span>
          {max}
          {unit ? ` ${unit}` : ""}
        </span>
      </div>
    </div>
  );
}
