import { eq } from "drizzle-orm";
import { getDb } from "./client";
import { users } from "./schema/auth";

/** Ops utility: `pnpm --filter @mogd/db db:promote-admin -- someone@example.com` */
async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: db:promote-admin -- <email>");
    process.exit(1);
  }

  const db = getDb();
  const [updated] = await db
    .update(users)
    .set({ role: "admin" })
    .where(eq(users.email, email))
    .returning({ id: users.id, email: users.email });

  if (!updated) {
    console.error(`No user found with email ${email}`);
    process.exit(1);
  }

  console.log(`${updated.email} is now an admin.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
