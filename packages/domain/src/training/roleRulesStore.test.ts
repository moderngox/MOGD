import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createTestDatabase } from "@mogd/db/testUtils";
import { schema, type Database } from "@mogd/db";
import { DEFAULT_ROLE_RULES, type RoleRules } from "./roleRules";
import {
  getCurrentRoleRules,
  getRoleRulesRevision,
  listRoleRulesRevisions,
  resetRoleRulesToDefaults,
  restoreRoleRulesRevision,
  RoleRulesInvalidError,
  RoleRulesRevisionNotFoundError,
  saveRoleRules,
} from "./roleRulesStore";

const withMainRest = (restMultiplier: number): RoleRules => ({
  ...DEFAULT_ROLE_RULES,
  roles: { ...DEFAULT_ROLE_RULES.roles, main: { restMultiplier } },
});

describe("role rules store", () => {
  let db: Database;
  let close: () => void;
  let adminId: string;

  beforeEach(async () => {
    const testDb = await createTestDatabase();
    db = testDb.db;
    close = testDb.close;
    const [admin] = await db
      .insert(schema.users)
      .values({ email: "admin@example.com", role: "admin" })
      .returning({ id: schema.users.id });
    adminId = admin!.id;
  });

  afterEach(() => close());

  it("falls back to the built-in defaults, with a null revision, when nothing is saved", async () => {
    expect(await getCurrentRoleRules(db)).toEqual({ rules: DEFAULT_ROLE_RULES, revisionId: null });
    expect(await getRoleRulesRevision(db, null)).toEqual(DEFAULT_ROLE_RULES);
  });

  it("makes the latest saved revision current", async () => {
    await saveRoleRules(db, adminId, withMainRest(1.5));
    const second = await saveRoleRules(db, adminId, withMainRest(1.8));

    const current = await getCurrentRoleRules(db);
    expect(current.revisionId).toBe(second.id);
    expect(current.rules.roles.main.restMultiplier).toBe(1.8);
  });

  it("lists history newest first with who and the note", async () => {
    await saveRoleRules(db, adminId, withMainRest(1.5), "first");
    await saveRoleRules(db, adminId, withMainRest(1.8), "  second  ");

    const history = await listRoleRulesRevisions(db);
    expect(history.map((h) => h.note)).toEqual(["second", "first"]);
    expect(history[0]!.createdByEmail).toBe("admin@example.com");
  });

  it("restoring appends a copy rather than rewriting history", async () => {
    const first = await saveRoleRules(db, adminId, withMainRest(1.5));
    await saveRoleRules(db, adminId, withMainRest(1.8));

    const restored = await restoreRoleRulesRevision(db, adminId, first.id);

    const history = await listRoleRulesRevisions(db);
    expect(history).toHaveLength(3);
    expect(history[0]!.id).toBe(restored.id);
    expect(history[0]!.note).toMatch(/Restored revision/);
    expect((await getCurrentRoleRules(db)).rules.roles.main.restMultiplier).toBe(1.5);
  });

  it("resetting to defaults is recorded as a revision too", async () => {
    await saveRoleRules(db, adminId, withMainRest(1.5));
    const reset = await resetRoleRulesToDefaults(db, adminId);

    const current = await getCurrentRoleRules(db);
    expect(current.revisionId).toBe(reset.id);
    expect(current.rules).toEqual(DEFAULT_ROLE_RULES);
  });

  it("never stores invalid input", async () => {
    await expect(saveRoleRules(db, adminId, withMainRest(5))).rejects.toThrow();
    await expect(saveRoleRules(db, adminId, { nonsense: true })).rejects.toThrow();
    expect(await db.select().from(schema.roleRulesRevisions)).toHaveLength(0);
  });

  it("rejects explicitly when persisted rules have become invalid, instead of defaulting", async () => {
    const [bad] = await db
      .insert(schema.roleRulesRevisions)
      .values({ rules: { roles: "garbage" } })
      .returning({ id: schema.roleRulesRevisions.id });

    await expect(getCurrentRoleRules(db)).rejects.toThrow(RoleRulesInvalidError);
    await expect(getRoleRulesRevision(db, bad!.id)).rejects.toThrow(RoleRulesInvalidError);
  });

  it("throws for an unknown revision id", async () => {
    await expect(getRoleRulesRevision(db, "does-not-exist")).rejects.toThrow(RoleRulesRevisionNotFoundError);
  });

  it("keeps a revision readable after its author is deleted", async () => {
    const saved = await saveRoleRules(db, adminId, withMainRest(1.5));
    await db.delete(schema.users);
    expect((await listRoleRulesRevisions(db))[0]!.createdByEmail).toBeNull();
    expect((await getRoleRulesRevision(db, saved.id)).roles.main.restMultiplier).toBe(1.5);
  });
});
