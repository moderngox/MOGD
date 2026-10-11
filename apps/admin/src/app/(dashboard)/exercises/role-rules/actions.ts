"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { requireAdmin } from "@mogd/shared/auth";
import { getDb } from "@mogd/db";
import { training } from "@mogd/domain";

async function requireAdminUserId(): Promise<string> {
  const session = await auth();
  requireAdmin(session);
  return session!.user!.id!;
}

/** Validated by the domain schema again here — never trust the client's own check. */
export async function saveRoleRulesAction(rules: training.RoleRules, note?: string) {
  const userId = await requireAdminUserId();
  await training.saveRoleRules(getDb(), userId, rules, note);
  revalidatePath("/exercises/role-rules");
}

export async function restoreRoleRulesAction(revisionId: string) {
  const userId = await requireAdminUserId();
  await training.restoreRoleRulesRevision(getDb(), userId, revisionId);
  revalidatePath("/exercises/role-rules");
}

export async function resetRoleRulesAction() {
  const userId = await requireAdminUserId();
  await training.resetRoleRulesToDefaults(getDb(), userId);
  revalidatePath("/exercises/role-rules");
}
