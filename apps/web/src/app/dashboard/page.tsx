import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { getDb } from "@mogd/db";
import { assessment, nutrition, programs, checkins, adaptation } from "@mogd/domain";
import {
  AppleIcon,
  Badge,
  BigStat,
  BottomNav,
  Button,
  Card,
  DumbbellIcon,
  HomeIcon,
  PowerIcon,
  ProgressBar,
  ProgressIcon,
  SidebarNav,
  Sparkline,
  Wordmark,
} from "@mogd/ui";

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/" });
}

function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={signOutAction} className={className}>
      <button
        type="submit"
        aria-label="Sign out"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-elevated text-fg-secondary transition-colors hover:border-border-strong hover:text-status-warning"
      >
        <PowerIcon className="h-5 w-5" />
      </button>
    </form>
  );
}

const STATUS_BADGE = {
  logged: { variant: "positive", label: "Logged" },
  today: { variant: "current", label: "Today" },
  scheduled: { variant: "neutral", label: "Scheduled" },
} as const;

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const db = getDb();
  const summary = await assessment.getUserAssessment(db, session.user.id);
  if (!summary) {
    redirect("/assessment");
  }

  const strategy = await nutrition.getGoalStrategy(db, session.user.id);
  const target = await nutrition.getNutritionTarget(db, session.user.id);
  const program = await programs.getCurrentProgram(db, session.user.id);
  const weeklySessions = await programs.getWeeklySessionStatus(db, session.user.id);
  const checkinHistory = await checkins.listCheckins(db, session.user.id);
  const latestAdjustment = await adaptation.getLatestPlanAdjustment(db, session.user.id);

  const latestCheckin = checkinHistory[0];
  const weightTrend = adaptation.computeActualWeeklyRateKg(
    checkinHistory
      .slice(0, 4)
      .map((c) => ({ averageWeightKg: c.averageWeightKg, completedAt: c.completedAt })),
  );

  const currentWeightKg = latestCheckin?.averageWeightKg ?? summary.weightKg;

  const weightPoints = [...checkinHistory]
    .slice(0, 8)
    .reverse()
    .map((c) => c.averageWeightKg);

  const todaySession = weeklySessions.find((w) => w.status === "today") ?? weeklySessions[0];
  const todayWorkout = todaySession
    ? program?.workouts.find((w) => w.workoutId === todaySession.workoutId)
    : undefined;
  const loggedCount = weeklySessions.filter((w) => w.status === "logged").length;

  const weekNumber = program
    ? Math.max(1, Math.floor((Date.now() - program.createdAt.getTime()) / MS_PER_WEEK) + 1)
    : null;
  const goalLabel = formatLabel(strategy?.primaryGoal ?? summary.primaryGoal).toUpperCase();

  const navItems = [
    { href: "/dashboard", label: "Today", active: true, icon: <HomeIcon /> },
    { href: "/program", label: "Training", icon: <DumbbellIcon /> },
    { href: "/checkin", label: "Nutrition", icon: <AppleIcon /> },
    { href: "/checkin", label: "Progress", icon: <ProgressIcon /> },
  ];

  return (
    <div className="flex min-h-screen">
      <SidebarNav items={navItems} />

      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-border bg-bg px-5 py-3 md:hidden">
          <Wordmark size="compact" />
          <SignOutButton />
        </div>

        <header className="flex items-center justify-between gap-3 border-b border-border bg-bg px-8 py-3">
          <span className="flex items-baseline gap-1.5 text-xs font-semibold uppercase tracking-wide">
            <span className="text-accent">{goalLabel}</span>
            {weekNumber !== null && <span className="text-fg-secondary">· Week {weekNumber}</span>}
          </span>
          <div className="flex items-center gap-4">
            <Link href="/account" className="text-sm text-fg-secondary hover:text-fg-secondary-alt">
              Account settings
            </Link>
            <SignOutButton className="hidden md:block" />
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-8 py-6 pb-24 md:pb-6">
          <h1 className="font-display text-3xl font-semibold text-fg">
            Today · {new Date().toLocaleDateString(undefined, { day: "numeric", month: "short" })}
          </h1>

          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-4">
              <Card>
                <span className="text-xs font-semibold uppercase tracking-wide text-accent">Next session</span>
                {todaySession ? (
                  <>
                    <div className="flex flex-col gap-1">
                      <h2 className="font-display text-2xl font-semibold text-fg">
                        {formatLabel(todaySession.sessionLabel)}
                      </h2>
                      <span className="text-sm text-fg-secondary-alt">
                        {todayWorkout?.exercises.length ?? 0} exercises ·{" "}
                        {todayWorkout?.estimatedDurationMinutes ?? 0} min
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/session/${todaySession.workoutId}`}>
                        <Button>Start session</Button>
                      </Link>
                      <Link href="/program">
                        <Button variant="outline">View exercises</Button>
                      </Link>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-fg-secondary">
                    No active program yet.{" "}
                    <Link href="/program" className="text-accent">
                      Set one up
                    </Link>
                    .
                  </p>
                )}
              </Card>

              <Card title="Nutrition" eyebrow={latestCheckin ? "Based on your last check-in" : undefined}>
                {target ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <BigStat label="Energy" value={Math.round(target.energyKcal)} unit="kcal" />
                      <BigStat label="Protein" value={Math.round(target.proteinG)} unit="g" />
                    </div>
                    {latestCheckin && (
                      <div className="flex flex-col gap-1.5 border-t border-border pt-3">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-sm text-fg-secondary-alt">Adherence at last check-in</span>
                          <span className="text-sm font-semibold tabular-nums text-fg">
                            {latestCheckin.nutritionAdherencePercent}%
                          </span>
                        </div>
                        <ProgressBar value={latestCheckin.nutritionAdherencePercent} max={100} />
                      </div>
                    )}
                    <div className="flex gap-6 border-t border-border pt-3">
                      <span className="flex flex-col gap-0.5">
                        <span className="text-xs font-semibold uppercase tracking-wide text-fg-secondary">
                          Carbohydrate
                        </span>
                        <span className="text-sm font-medium tabular-nums text-fg-secondary-alt">
                          {Math.round(target.carbG)} g
                        </span>
                      </span>
                      <span className="flex flex-col gap-0.5">
                        <span className="text-xs font-semibold uppercase tracking-wide text-fg-secondary">Fat</span>
                        <span className="text-sm font-medium tabular-nums text-fg-secondary-alt">
                          {Math.round(target.fatG)} g
                        </span>
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-fg-secondary">Not available yet.</p>
                )}
              </Card>
            </div>

            <div className="flex flex-col gap-4">
              <Card title="This week">
                {weeklySessions.length > 0 ? (
                  <>
                    <span className="font-display text-2xl font-semibold tabular-nums text-fg">
                      {loggedCount}{" "}
                      <span className="text-sm font-normal text-fg-secondary">
                        of {weeklySessions.length} sessions logged
                      </span>
                    </span>
                    <ul className="flex flex-col gap-2">
                      {weeklySessions.map((w) => {
                        const badge = STATUS_BADGE[w.status];
                        return (
                          <li key={w.workoutId} className="flex items-center justify-between gap-3">
                            <span className="flex flex-col">
                              <span className="text-sm font-medium text-fg">{formatLabel(w.sessionLabel)}</span>
                              {w.loggedAt && (
                                <span className="text-xs text-fg-secondary">{formatShortDate(w.loggedAt)}</span>
                              )}
                            </span>
                            <Badge variant={badge.variant}>{badge.label}</Badge>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                ) : (
                  <p className="text-sm text-fg-secondary">No program yet.</p>
                )}
              </Card>

              <Card
                title="Bodyweight"
                eyebrow={latestCheckin ? formatShortDate(latestCheckin.completedAt) : undefined}
              >
                <BigStat label="Current" value={currentWeightKg} unit="kg" />
                <Sparkline points={weightPoints} height={48} />
                {weightTrend !== null && (
                  <p className="text-sm text-fg-secondary-alt">
                    {weightTrend >= 0 ? "Up" : "Down"} {Math.abs(weightTrend).toFixed(2)} kg a week, recently.
                  </p>
                )}
              </Card>

              {latestAdjustment && (
                <Card>
                  <span className="text-xs font-semibold uppercase tracking-wide text-accent">
                    Proposed change · AI generated
                  </span>
                  <p className="text-sm text-fg">{latestAdjustment.reason}</p>
                  <Link href="/checkin">
                    <Button variant="secondary">Review change</Button>
                  </Link>
                </Card>
              )}
            </div>
          </div>
        </main>
      </div>

      <BottomNav items={navItems} />
    </div>
  );
}
