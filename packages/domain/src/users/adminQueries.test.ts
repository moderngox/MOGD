import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createTestDatabase } from "@mogd/db/testUtils";
import { schema, type Database } from "@mogd/db";
import { listUsers } from "./adminQueries";

describe("listUsers", () => {
  let db: Database;
  let close: () => void;

  beforeEach(async () => {
    const testDb = await createTestDatabase();
    db = testDb.db;
    close = testDb.close;
  });

  afterEach(() => close());

  it("lists every user with their role, newest first", async () => {
    await db.insert(schema.users).values({ email: "first@example.com", role: "user" });
    await db.insert(schema.users).values({ email: "second-admin@example.com", role: "admin" });

    const rows = await listUsers(db);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.email).sort()).toEqual(["first@example.com", "second-admin@example.com"]);
    expect(rows.find((r) => r.email === "second-admin@example.com")?.role).toBe("admin");
  });
});
