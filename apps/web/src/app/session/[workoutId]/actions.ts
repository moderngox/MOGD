"use server";

import { auth } from "@/auth";
import { getDb } from "@mogd/db";
import { programs, progress } from "@mogd/domain";

export async function logSetAction(input: {
  exerciseId: string;
  workoutId: string;
  setNumber: number;
  loadKg?: number;
  reps: number;
  rir?: number;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  // Re-verify ownership here too — this action can be invoked directly,
  // not only from a page that already checked.
  const ownerId = await programs.getWorkoutOwnerId(getDb(), input.workoutId);
  if (ownerId !== session.user.id) {
    throw new Error("Not authorized");
  }

  return progress.logWorkoutSet(getDb(), session.user.id, input);
}
