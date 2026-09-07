import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import * as schema from "./schema";

describe("db schema", () => {
  let client: ReturnType<typeof createClient>;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  beforeEach(async () => {
    client = createClient({ url: ":memory:" });
    db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: "./drizzle" });
  });

  afterEach(() => {
    client.close();
  });

  it("inserts and reads back a user with default role", async () => {
    await db.insert(schema.users).values({
      email: "coach@example.com",
    });

    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "coach@example.com"));

    expect(user?.role).toBe("user");
    expect(user?.passwordHash).toBeNull();
  });

  it("records an ai run with a rejected validation status", async () => {
    await db.insert(schema.aiRuns).values({
      purpose: "foundation-smoke-test",
      provider: "anthropic",
      model: "test-model",
      promptVersion: "v0",
      schemaVersion: "v0",
      inputHash: "sha256:test",
      validationStatus: "rejected",
      errorClassification: "schema_mismatch",
      latencyMs: 12,
    });

    const runs = await db.select().from(schema.aiRuns);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.validationStatus).toBe("rejected");
  });
});
