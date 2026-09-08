import { notFound } from "next/navigation";
import Link from "next/link";
import { getDb, schema } from "@mogd/db";
import { eq } from "drizzle-orm";
import { assessment, nutrition, programs, checkins, adaptation } from "@mogd/domain";

function label(value: string): string {
  return value.replaceAll("_", " ");
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();

  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
  if (!user) notFound();

  const [profile, strategy, target, program, checkinHistory, adjustments] = await Promise.all([
    assessment.getUserAssessment(db, id),
    nutrition.getGoalStrategy(db, id),
    nutrition.getNutritionTarget(db, id),
    programs.getCurrentProgram(db, id),
    checkins.listCheckins(db, id),
    adaptation.listPlanAdjustments(db, id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/users" className="text-sm text-zinc-500 hover:underline">
          ← Users
        </Link>
        <h1 className="text-2xl font-semibold">{user.email}</h1>
        <p className="text-sm text-zinc-500">
          {user.role} · joined {new Date(user.createdAt).toISOString().slice(0, 10)}
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Profile / assessment</h2>
        {profile ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-zinc-500">Primary goal</dt>
            <dd>{label(profile.primaryGoal)}</dd>
            <dt className="text-zinc-500">Physique priorities</dt>
            <dd>{profile.physiquePriorities.map(label).join(", ") || "balanced"}</dd>
            <dt className="text-zinc-500">Sex / age</dt>
            <dd>
              {profile.sex} / {profile.age}
            </dd>
            <dt className="text-zinc-500">Height / weight</dt>
            <dd>
              {profile.heightCm} cm / {profile.weightKg} kg
            </dd>
            <dt className="text-zinc-500">Waist</dt>
            <dd>{profile.waistCm} cm</dd>
            <dt className="text-zinc-500">Experience</dt>
            <dd>{label(profile.experienceLevel)}</dd>
            <dt className="text-zinc-500">Training</dt>
            <dd>
              {profile.sessionsPerWeek}/week · {profile.sessionDurationMinutes} min ·{" "}
              {profile.trainingContext.map(label).join(", ")}
            </dd>
            <dt className="text-zinc-500">Nutrition profile</dt>
            <dd>
              {label(profile.dietaryPreference)} · {profile.mealsPerDay} meals/day
            </dd>
          </dl>
        ) : (
          <p className="text-sm text-zinc-500">No assessment submitted yet.</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Strategy / nutrition targets</h2>
        {strategy && target ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-zinc-500">Energy direction</dt>
            <dd>{label(strategy.energyDirection)}</dd>
            <dt className="text-zinc-500">Priority muscles</dt>
            <dd>{strategy.priorityMuscles.map(label).join(", ")}</dd>
            <dt className="text-zinc-500">BMR / TDEE</dt>
            <dd>
              {Math.round(target.bmr)} / {Math.round(target.tdee)} kcal
            </dd>
            <dt className="text-zinc-500">Energy target</dt>
            <dd>{Math.round(target.energyKcal)} kcal/day</dd>
            <dt className="text-zinc-500">Macros</dt>
            <dd>
              {Math.round(target.proteinG)}p / {Math.round(target.fatG)}f /{" "}
              {Math.round(target.carbG)}c
            </dd>
          </dl>
        ) : (
          <p className="text-sm text-zinc-500">No strategy generated yet.</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Program</h2>
        {program ? (
          <div className="flex flex-col gap-3 text-sm">
            <p className="text-zinc-400">
              {label(program.splitType)} · {program.sessionsPerWeek} sessions/week · validated at
              generation time (reject-before-persist — an invalid program is never stored).
            </p>
            {program.workouts.map((workout) => (
              <div key={workout.workoutId} className="rounded-md border border-zinc-800 p-3">
                <p className="font-medium">
                  Day {workout.dayIndex + 1}: {label(workout.sessionLabel)} · ~
                  {workout.estimatedDurationMinutes} min
                </p>
                <ul className="mt-1 text-zinc-400">
                  {workout.exercises.map((ex) => (
                    <li key={ex.workoutExerciseId}>
                      {ex.name} — {ex.sets} × {ex.repMin}-{ex.repMax} (RIR {ex.rir})
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No program generated yet.</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Check-ins ({checkinHistory.length})</h2>
        {checkinHistory.length === 0 ? (
          <p className="text-sm text-zinc-500">No check-ins yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-zinc-500">
              <tr>
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Weight</th>
                <th className="py-2 pr-4">Waist</th>
                <th className="py-2 pr-4">Training adherence</th>
                <th className="py-2 pr-4">Nutrition adherence</th>
              </tr>
            </thead>
            <tbody>
              {checkinHistory.map((c) => (
                <tr key={c.id} className="border-t border-zinc-800">
                  <td className="py-2 pr-4">{new Date(c.completedAt).toISOString().slice(0, 10)}</td>
                  <td className="py-2 pr-4">{c.averageWeightKg} kg</td>
                  <td className="py-2 pr-4">{c.waistCm} cm</td>
                  <td className="py-2 pr-4">{c.trainingAdherencePercent}%</td>
                  <td className="py-2 pr-4">{c.nutritionAdherencePercent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Adjustment history ({adjustments.length})</h2>
        {adjustments.length === 0 ? (
          <p className="text-sm text-zinc-500">No adaptation runs yet.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {adjustments.map((a) => (
              <li key={a.id} className="rounded-md border border-zinc-800 p-3">
                <p className="text-zinc-500">
                  {new Date(a.createdAt).toISOString().slice(0, 10)} · {label(a.decisionType)} ·{" "}
                  {a.outcome}
                </p>
                <p>{a.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
