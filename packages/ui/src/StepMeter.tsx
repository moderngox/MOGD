export interface StepMeterProps {
  step: number;
  total: number;
}

/**
 * Segmented step progress for multi-step flows (design.md section 3,
 * Onboarding). One filled segment per completed/current step, rather than a
 * single continuous ProgressBar fill, so step boundaries stay legible.
 */
export function StepMeter({ step, total }: StepMeterProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-fg-secondary">
        Step {step + 1} of {total}
      </span>
      <div
        role="progressbar"
        aria-valuenow={step + 1}
        aria-valuemin={1}
        aria-valuemax={total}
        className="flex gap-1"
      >
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={i <= step ? "h-1.5 flex-1 rounded-full bg-accent" : "h-1.5 flex-1 rounded-full bg-surface-elevated"}
          />
        ))}
      </div>
    </div>
  );
}
