import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { schema, type Database } from "@mogd/db";
import { registerUser, EmailAlreadyRegisteredError } from "./registerUser";

describe("registerUser", () => {
  let client: ReturnType<typeof createClient>;
  let db: Database;

  beforeEach(async () => {
    client = createClient({ url: ":memory:" });
    db = drizzle(client, { schema }) as unknown as Database;
    await migrate(db as never, {
      migrationsFolder: "../db/drizzle",
    });
  });

  afterEach(() => {
    client.close();
  });

  it("creates a user with a hashed password and default role", async () => {
    const user = await registerUser(db, {
      email: "athlete@example.com",
      password: "correct-horse-battery-staple",
    });

    expect(user?.email).toBe("athlete@example.com");
  });

  it("rejects a duplicate email", async () => {
    await registerUser(db, {
      email: "dupe@example.com",
      password: "correct-horse-battery-staple",
    });

    await expect(
      registerUser(db, {
        email: "dupe@example.com",
        password: "another-password-here",
      }),
    ).rejects.toThrow(EmailAlreadyRegisteredError);
  });

  it("rejects a password under the minimum length", async () => {
    await expect(
      registerUser(db, { email: "short@example.com", password: "short" }),
    ).rejects.toThrow();
  });
});
