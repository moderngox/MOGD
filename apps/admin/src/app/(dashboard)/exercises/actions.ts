"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { requireAdmin } from "@mogd/shared/auth";
import { getDb } from "@mogd/db";
import { exercises } from "@mogd/domain";

async function requireAdminSession() {
  const session = await auth();
  requireAdmin(session);
  return session;
}

export async function createExerciseAction(input: exercises.CreateExerciseInput) {
  await requireAdminSession();
  const exercise = await exercises.createExercise(getDb(), input);
  revalidatePath("/exercises");
  // Returns rather than calling redirect() here: this action is invoked by
  // a direct client-side call wrapped in try/catch (see ExerciseForm.tsx),
  // and redirect() throws a control-flow error that such a catch would
  // swallow and misreport as a save failure. The caller navigates instead.
  return { id: exercise!.id };
}

export async function updateExerciseAction(id: string, input: exercises.UpdateExerciseInput) {
  await requireAdminSession();
  await exercises.updateExercise(getDb(), id, input);
  revalidatePath("/exercises");
  revalidatePath(`/exercises/${id}`);
}

export async function setExerciseActiveAction(id: string, isActive: boolean) {
  await requireAdminSession();
  await exercises.setExerciseActive(getDb(), id, isActive);
  revalidatePath("/exercises");
  revalidatePath(`/exercises/${id}`);
}
