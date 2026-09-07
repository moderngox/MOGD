import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "./schema";
import type { Database } from "./client";

export interface TestDatabase {
  db: Database;
  close: () => void;
}

/**
 * A real temp-file-backed SQLite database with migrations applied, for
 * tests that call db.transaction(). A bare ":memory:" URL opens a *separate
 * connection* for the transaction that sees an empty database — a
 * @libsql/client local-mode limitation specific to anonymous in-memory
 * DBs. Dev and prod always use a real file or a remote Turso database, so
 * this only ever bites tests; a real (temp) file sidesteps it entirely.
 *
 * migrationsFolder is relative to the caller's cwd (how drizzle's migrate()
 * resolves it), not to this file — the default matches every current
 * sibling package's test setup (packages/domain, packages/ai, ...).
 */
export async function createTestDatabase(migrationsFolder = "../db/drizzle"): Promise<TestDatabase> {
  const filePath = join(tmpdir(), `mogd-test-${randomUUID()}.db`);
  const client = createClient({ url: `file:${filePath}` });
  const db = drizzle(client, { schema }) as unknown as Database;

  await migrate(db as never, { migrationsFolder });

  const close = () => {
    client.close();
    for (const suffix of ["", "-journal", "-wal", "-shm"]) {
      try {
        rmSync(filePath + suffix, { force: true });
      } catch {
        // best-effort cleanup only
      }
    }
  };

  return { db, close };
}
