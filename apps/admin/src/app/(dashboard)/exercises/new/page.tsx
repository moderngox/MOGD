import { ExerciseForm } from "../ExerciseForm";

export default function NewExercisePage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">New exercise</h1>
      <ExerciseForm />
    </div>
  );
}
