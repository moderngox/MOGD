import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { loadDbEnv } from "./env";

async function main() {
  const env = loadDbEnv();
  const client = createClient({
    url: env.DATABASE_URL,
    authToken: env.DATABASE_AUTH_TOKEN,
  });
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied.");
  client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
