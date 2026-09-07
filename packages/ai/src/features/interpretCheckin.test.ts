import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { schema, type Database } from "@mogd/db";
import { interpretCheckin } from "./interpretCheckin";
import { StructuredOutputValidationError } from "../provider";
import type { StructuredGenerationProvider, StructuredGenerationResult } from "../provider";

const BASE_CONTEXT = {
  decisionType: "hold" as const,
  deterministicReason: "Actual trend is close to the expected rate — plan is working as expected.",
  nutritionAdherencePercent: 90,
  hunger: 3,
  energy: 3,
  recovery: 3,
};

function fakeProvider(
  behavior: "accept" | "digits" | "throw",
): StructuredGenerationProvider {
  return {
    providerName: "fake",
    modelName: "fake-model",
    generateStructured: async <T>(): Promise<StructuredGenerationResult<T>> => {
      if (behavior === "throw") throw new Error("provider unavailable");
      if (behavior === "digits") {
        throw new StructuredOutputValidationError("check_in_interpretation", "summary: must not contain digits");
      }
      return {
        data: { summary: "Steady progress in line with plan.", encouragement: "Keep it up." } as T,
        latencyMs: 5,
        provider: "fake",
        model: "fake-model",
      };
    },
  };
}

describe("interpretCheckin", () => {
  let client: ReturnType<typeof createClient>;
  let db: Database;
  let userId: string;

  beforeEach(async () => {
    client = createClient({ url: ":memory:" });
    db = drizzle(client, { schema }) as unknown as Database;
    await migrate(db as never, { migrationsFolder: "../db/drizzle" });

    const [user] = await db
      .insert(schema.users)
      .values({ email: "interpret-checkin@example.com" })
      .returning({ id: schema.users.id });
    userId = user!.id;
  });

  afterEach(() => {
    client.close();
  });

  it("returns null without calling any provider when AI is unconfigured", async () => {
    const result = await interpretCheckin(db, userId, BASE_CONTEXT);
    expect(result).toBeNull();

    const runs = await db.select().from(schema.aiRuns);
    expect(runs).toHaveLength(0);
  });

  it("returns the validated interpretation on success, and logs an accepted run", async () => {
    const result = await interpretCheckin(db, userId, BASE_CONTEXT, fakeProvider("accept"));
    expect(result).toEqual({
      summary: "Steady progress in line with plan.",
      encouragement: "Keep it up.",
    });

    const runs = await db.select().from(schema.aiRuns);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.validationStatus).toBe("accepted");
    expect(runs[0]?.purpose).toBe("checkin_interpretation");
  });

  it("fails safely to null when the model output is rejected (e.g. contains digits), without throwing", async () => {
    const result = await interpretCheckin(db, userId, BASE_CONTEXT, fakeProvider("digits"));
    expect(result).toBeNull();

    const runs = await db.select().from(schema.aiRuns);
    expect(runs[0]?.validationStatus).toBe("rejected");
  });

  it("fails safely to null when the provider is unavailable, without throwing", async () => {
    const result = await interpretCheckin(db, userId, BASE_CONTEXT, fakeProvider("throw"));
    expect(result).toBeNull();

    const runs = await db.select().from(schema.aiRuns);
    expect(runs[0]?.validationStatus).toBe("error");
  });
});
