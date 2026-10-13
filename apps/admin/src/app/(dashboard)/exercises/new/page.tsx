import { getDb } from "@mogd/db";
import { safety } from "@mogd/domain";
import { ExerciseForm } from "../ExerciseForm";

export default async function NewExercisePage() {
  const categories = await safety.listRestrictionCategories(getDb());
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-3xl font-semibold text-fg">New exercise</h1>
      <ExerciseForm restrictionCategories={categories.map((c) => ({ key: c.key, label: c.label }))} />
    </div>
  );
}
