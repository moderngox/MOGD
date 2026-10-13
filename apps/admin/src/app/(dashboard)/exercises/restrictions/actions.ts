"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { requireAdmin } from "@mogd/shared/auth";
import { getDb } from "@mogd/db";
import { safety } from "@mogd/domain";

async function requireAdminSession() {
  const session = await auth();
  requireAdmin(session);
}

/**
 * Domain errors are turned into a message here: Next masks the text of anything a
 * server action throws, and "still in use" or "already exists" is exactly what the
 * admin needs to read.
 */
async function run<T>(work: () => Promise<T>): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await work();
    revalidatePath("/exercises/restrictions");
    return { ok: true };
  } catch (error) {
    if (
      error instanceof safety.DuplicateRestrictionKeyError ||
      error instanceof safety.RestrictionInUseError ||
      error instanceof safety.RestrictionNotFoundError
    ) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}

export async function createRestrictionAction(key: string, label: string) {
  await requireAdminSession();
  // Shape errors (bad key, empty label) are checked client-side with the same schema and re-thrown here.
  safety.createRestrictionCategoryInput.parse({ key, label });
  return run(() => safety.createRestrictionCategory(getDb(), { key, label }));
}

export async function renameRestrictionAction(id: string, label: string) {
  await requireAdminSession();
  safety.restrictionLabelSchema.parse(label);
  return run(() => safety.renameRestrictionCategory(getDb(), id, label));
}

export async function deleteRestrictionAction(id: string) {
  await requireAdminSession();
  return run(() => safety.deleteRestrictionCategory(getDb(), id));
}
