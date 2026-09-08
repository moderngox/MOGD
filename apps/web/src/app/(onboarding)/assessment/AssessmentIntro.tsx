import { Button, Card } from "@mogd/ui";

const INFO_ROWS: { eyebrow: string; body: string }[] = [
  { eyebrow: "Time", body: "About 5 minutes, eight short sections." },
  { eyebrow: "Edit", body: "Everything here can be changed later from your profile." },
  {
    eyebrow: "Safety",
    body: "MOGᴰ trains around limitations you report. It does not diagnose or treat injuries.",
  },
];

export function AssessmentIntro({ onStart }: { onStart: () => void }) {
  return (
    <Card className="gap-5">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-semibold text-fg">Build your training program</h1>
        <p className="text-sm text-fg-secondary">
          A short structured assessment — goal, body, training history, availability and
          nutrition. MOGᴰ uses it to set your starting targets and program.
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {INFO_ROWS.map((row) => (
          <li key={row.eyebrow} className="flex gap-3 text-sm">
            <span className="w-14 shrink-0 font-display text-xs font-semibold uppercase tracking-wide text-accent">
              {row.eyebrow}
            </span>
            <span className="text-fg-secondary-alt">{row.body}</span>
          </li>
        ))}
      </ul>
      <Button onClick={onStart} className="w-full">
        Start assessment
      </Button>
    </Card>
  );
}
