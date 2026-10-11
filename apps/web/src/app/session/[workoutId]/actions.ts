"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@mogd/db";
import { progress } from "@mogd/domain";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

/**
 * Upsert of one set into the in-progress occurrence of this program slot
 * (starting it on the first set). Ownership of the workout is verified inside
 * the domain call — this action can be invoked directly, not only from a page
 * that already checked.
 */
export async function logSetAction(input: progress.LogSetInput) {
  const userId = await requireUserId();
  const db = getDb();
  const set = await progress.logSet(db, userId, input);
  const session = await progress.getInProgressSession(db, userId, input.workoutId);
  return { setId: set.id, performanceId: set.workoutExercisePerformanceId!, sessionId: session?.id ?? null };
}

export async function deleteLastSetAction(performanceId: string) {
  const userId = await requireUserId();
  return progress.deleteLastSet(getDb(), userId, performanceId);
}

export async function correctSetAction(setId: string, correction: progress.SetCorrectionInput) {
  const userId = await requireUserId();
  await progress.correctSet(getDb(), userId, setId, correction);
  revalidatePath("/session", "layout");
}

export async function finishSessionAction(sessionId: string) {
  const userId = await requireUserId();
  const session = await progress.finishSession(getDb(), userId, sessionId);
  revalidatePath("/dashboard");
  revalidatePath("/program");
  return { sessionId: session.id };
}
