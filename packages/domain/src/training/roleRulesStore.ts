import { desc, eq, sql } from "drizzle-orm";
import { schema, type Database } from "@mogd/db";
import { DEFAULT_ROLE_RULES, roleRulesSchema, type RoleRules } from "./roleRules";

export class RoleRulesInvalidError extends Error {
  constructor(revisionId: string, detail: string) {
    super(`Saved role rules (revision ${revisionId}) are invalid: ${detail}`);
    this.name = "RoleRulesInvalidError";
  }
}

export class RoleRulesRevisionNotFoundError extends Error {
  constructor(id: string) {
    super(`No role-rules revision "${id}"`);
    this.name = "RoleRulesRevisionNotFoundError";
  }
}

export interface CurrentRoleRules {
  rules: RoleRules;
  /** Null = the built-in defaults (no revision saved yet). */
  revisionId: string | null;
}

/** Persisted JSON is re-validated on every read; invalid state is rejected, never silently defaulted. */
function parsePersisted(row: { id: string; rules: unknown }): RoleRules {
  const result = roleRulesSchema.safeParse(row.rules);
  if (!result.success) {
    const detail = result.error.issues.map((i) => `${i.path.join(".") || "rules"}: ${i.message}`).join("; ");
    throw new RoleRulesInvalidError(row.id, detail);
  }
  return result.data;
}

/** The latest revision, or the built-in defaults when none exists. */
export async function getCurrentRoleRules(db: Database): Promise<CurrentRoleRules> {
  const [latest] = await db
    .select()
    .from(schema.roleRulesRevisions)
    // rowid breaks ties between two saves in the same millisecond.
    .orderBy(desc(schema.roleRulesRevisions.createdAt), sql`rowid desc`)
    .limit(1);
  if (!latest) return { rules: DEFAULT_ROLE_RULES, revisionId: null };
  return { rules: parsePersisted(latest), revisionId: latest.id };
}

/** A specific revision (null = built-in defaults) — what the validator re-checks a plan against. */
export async function getRoleRulesRevision(db: Database, revisionId: string | null): Promise<RoleRules> {
  if (revisionId === null) return DEFAULT_ROLE_RULES;
  const [row] = await db.select().from(schema.roleRulesRevisions).where(eq(schema.roleRulesRevisions.id, revisionId));
  if (!row) throw new RoleRulesRevisionNotFoundError(revisionId);
  return parsePersisted(row);
}

/** Validates then appends a revision; invalid input is never stored (throws the ZodError). */
export async function saveRoleRules(
  db: Database,
  userId: string | null,
  rawRules: unknown,
  note?: string,
): Promise<{ id: string }> {
  const rules = roleRulesSchema.parse(rawRules);
  const [created] = await db
    .insert(schema.roleRulesRevisions)
    .values({ createdByUserId: userId, note: note?.trim() ? note.trim().slice(0, 200) : null, rules })
    .returning({ id: schema.roleRulesRevisions.id });
  return { id: created!.id };
}

export interface RoleRulesRevisionSummary {
  id: string;
  createdAt: Date;
  createdByEmail: string | null;
  note: string | null;
}

/** Newest first. */
export async function listRoleRulesRevisions(db: Database): Promise<RoleRulesRevisionSummary[]> {
  return db
    .select({
      id: schema.roleRulesRevisions.id,
      createdAt: schema.roleRulesRevisions.createdAt,
      createdByEmail: schema.users.email,
      note: schema.roleRulesRevisions.note,
    })
    .from(schema.roleRulesRevisions)
    .leftJoin(schema.users, eq(schema.roleRulesRevisions.createdByUserId, schema.users.id))
    .orderBy(desc(schema.roleRulesRevisions.createdAt), sql`${schema.roleRulesRevisions}.rowid desc`);
}

/** Rollback is itself a recorded change: appends a copy of the old revision. */
export async function restoreRoleRulesRevision(db: Database, userId: string | null, revisionId: string) {
  const rules = await getRoleRulesRevision(db, revisionId);
  return saveRoleRules(db, userId, rules, `Restored revision ${revisionId.slice(0, 8)}`);
}

export async function resetRoleRulesToDefaults(db: Database, userId: string | null) {
  return saveRoleRules(db, userId, DEFAULT_ROLE_RULES, "Reset to built-in defaults");
}
