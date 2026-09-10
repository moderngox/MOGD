import { ExerciseForm } from "../ExerciseForm";

export default function NewExercisePage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-3xl font-semibold text-fg">New exercise</h1>
      <ExerciseForm />
    </div>
  );
}
