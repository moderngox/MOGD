import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createTestDatabase } from "./testUtils";
import * as schema from "./schema";

const MIGRATION = readFileSync(new URL("../drizzle/0020_explicit_role_eligibility.sql", import.meta.url), "utf8");

/** The UPDATE statement, without the leading SQL comment lines. */
const statement = MIGRATION.split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n")
  .trim()
  .replace(/;$/, "");

const row = (canonicalId: string, allowedSessionRoles: string[]) => ({
  canonicalId,
  name: canonicalId,
  movementPattern: "push",
  difficulty: "beginner",
  primaryMuscles: ["upper_chest"],
  secondaryMuscles: [],
  equipment: [],
  contraindicationTags: [],
  allowedSessionRoles,
});

describe("migration 0020: explicit role eligibility", () => {
  it("moves empty role lists to an explicit accessory default and touches nothing else", async () => {
    const { db, close } = await createTestDatabase();
    try {
      await db.insert(schema.exercises).values([row("legacy_empty", []), row("configured", ["main", "finisher"])]);

      await db.run(sql.raw(statement));

      const roles = async (canonicalId: string) =>
        (await db.select().from(schema.exercises).where(eq(schema.exercises.canonicalId, canonicalId)))[0]!.allowedSessionRoles;
      expect(await roles("legacy_empty")).toEqual(["accessory"]);
      expect(await roles("configured")).toEqual(["main", "finisher"]);
    } finally {
      close();
    }
  });

  it("is a no-op when run again", async () => {
    const { db, close } = await createTestDatabase();
    try {
      await db.insert(schema.exercises).values([row("legacy_empty", []), row("configured", ["accessory", "superset"])]);

      await db.run(sql.raw(statement));
      await db.run(sql.raw(statement));

      const all = await db.select().from(schema.exercises);
      expect(all.map((e) => e.allowedSessionRoles).sort()).toEqual([["accessory", "superset"], ["accessory"]].sort());
    } finally {
      close();
    }
  });
});
