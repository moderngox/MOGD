import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { schema, type Database } from "@mogd/db";
import { z } from "zod";
import { runStructuredGeneration } from "./runLogger";
import {
  StructuredOutputValidationError,
  type StructuredGenerationProvider,
  type StructuredGenerationResult,
} from "./provider";

const outputSchema = z.object({ greeting: z.string() });

function fakeProvider(behavior: "accept" | "invalid" | "throw"): StructuredGenerationProvider {
  return {
    providerName: "fake",
    modelName: "fake-model",
    generateStructured: async <T>(): Promise<StructuredGenerationResult<T>> => {
      if (behavior === "throw") throw new Error("provider unavailable");
      if (behavior === "invalid") {
        throw new StructuredOutputValidationError("greeting_schema", "greeting: Required");
      }
      return {
        data: { greeting: "hello" } as T,
        latencyMs: 5,
        provider: "fake",
        model: "fake-model",
      };
    },
  };
}

describe("runStructuredGeneration", () => {
  let client: ReturnType<typeof createClient>;
  let db: Database;

  beforeEach(async () => {
    client = createClient({ url: ":memory:" });
    db = drizzle(client, { schema }) as unknown as Database;
    await migrate(db as never, { migrationsFolder: "../db/drizzle" });
  });

  afterEach(() => {
    client.close();
  });

  it("logs an accepted run and returns the validated data", async () => {
    const result = await runStructuredGeneration(db, fakeProvider("accept"), {
      purpose: "smoke_test",
      schema: outputSchema,
      schemaName: "greeting_schema",
      schemaVersion: "v1",
      promptVersion: "v1",
      prompt: "say hello",
    });

    expect(result.data.greeting).toBe("hello");

    const runs = await db.select().from(schema.aiRuns);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.validationStatus).toBe("accepted");
  });

  it("logs a rejected run and rethrows on invalid output, without persisting fabricated data", async () => {
    await expect(
      runStructuredGeneration(db, fakeProvider("invalid"), {
        purpose: "smoke_test",
        schema: outputSchema,
        schemaName: "greeting_schema",
        schemaVersion: "v1",
        promptVersion: "v1",
        prompt: "say hello",
      }),
    ).rejects.toThrow(StructuredOutputValidationError);

    const runs = await db.select().from(schema.aiRuns);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.validationStatus).toBe("rejected");
    expect(runs[0]?.validatedOutput).toBeNull();
  });

  it("logs an error run when the provider itself fails", async () => {
    await expect(
      runStructuredGeneration(db, fakeProvider("throw"), {
        purpose: "smoke_test",
        schema: outputSchema,
        schemaName: "greeting_schema",
        schemaVersion: "v1",
        promptVersion: "v1",
        prompt: "say hello",
      }),
    ).rejects.toThrow("provider unavailable");

    const runs = await db.select().from(schema.aiRuns);
    expect(runs[0]?.validationStatus).toBe("error");
  });
});
