import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { schema, type Database } from "@mogd/db";
import { z } from "zod";

export const registerUserInput = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1).max(100).optional(),
});

export type RegisterUserInput = z.infer<typeof registerUserInput>;

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super("An account with this email already exists");
    this.name = "EmailAlreadyRegisteredError";
  }
}

/**
 * Credentials registration. Always hashes server-side; the raw password is
 * never persisted or logged.
 */
export async function registerUser(db: Database, input: RegisterUserInput) {
  const parsed = registerUserInput.parse(input);

  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, parsed.email));

  if (existing) {
    throw new EmailAlreadyRegisteredError();
  }

  const passwordHash = await bcrypt.hash(parsed.password, 12);

  const [user] = await db
    .insert(schema.users)
    .values({
      email: parsed.email,
      name: parsed.name,
      passwordHash,
    })
    .returning({ id: schema.users.id, email: schema.users.email });

  return user;
}
