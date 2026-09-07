import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { loadDbEnv } from "./env";
import * as schema from "./schema";

let cached: ReturnType<typeof buildDb> | undefined;

function buildDb() {
  const env = loadDbEnv();
  const client = createClient({
    url: env.DATABASE_URL,
    authToken: env.DATABASE_AUTH_TOKEN,
  });
  return drizzle(client, { schema });
}

/** Lazily-constructed singleton so importing this module never fails at
 * module-load time when env vars aren't set yet (e.g. during typecheck). */
export function getDb() {
  if (!cached) {
    cached = buildDb();
  }
  return cached;
}

export type Database = ReturnType<typeof getDb>;
