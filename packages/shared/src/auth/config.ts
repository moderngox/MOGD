import { DrizzleAdapter } from "@auth/drizzle-adapter";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import type { NextAuthConfig } from "next-auth";
import type { Database } from "@mogd/db";
import { schema } from "@mogd/db";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

/**
 * One Auth.js config shared by both apps/web and apps/admin. Both processes
 * use the same AUTH_SECRET, so a JWT session minted by one app decrypts
 * successfully in the other. Session strategy is deliberately "jwt", not
 * "database": Auth.js's Credentials provider does not support database
 * sessions (it never creates a persisted Session row via the adapter for
 * credentials-based sign-in), so "database" here would silently break
 * sign-in. The adapter is still wired up for its users/accounts/
 * verificationTokens tables, which a future OAuth provider would need.
 *
 * Role is re-read from the database on every request inside the jwt
 * callback (not just at sign-in), so a role change made via
 * db:promote-admin takes effect on the user's next request rather than
 * waiting for their token to expire. Admin-only access is enforced
 * separately via requireAdmin(), not by this config.
 */
export function buildAuthConfig(db: Database): NextAuthConfig {
  return {
    adapter: DrizzleAdapter(db, {
      usersTable: schema.users,
      accountsTable: schema.accounts,
      sessionsTable: schema.sessions,
      verificationTokensTable: schema.verificationTokens,
    }),
    session: { strategy: "jwt" },
    providers: [
      Credentials({
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        authorize: async (raw) => {
          const parsed = credentialsSchema.safeParse(raw);
          if (!parsed.success) return null;

          const [user] = await db
            .select()
            .from(schema.users)
            .where(eq(schema.users.email, parsed.data.email));

          if (!user?.passwordHash) return null;

          const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
          if (!valid) return null;

          return { id: user.id, email: user.email, name: user.name };
        },
      }),
    ],
    callbacks: {
      jwt: async ({ token, user }) => {
        const userId = user?.id ?? (typeof token.id === "string" ? token.id : undefined);
        if (!userId) return token;

        const [record] = await db
          .select({ role: schema.users.role })
          .from(schema.users)
          .where(eq(schema.users.id, userId));

        token.id = userId;
        token.role = record?.role ?? "user";
        return token;
      },
      session: async ({ session, token }) => ({
        ...session,
        user: {
          ...session.user,
          id: token.id as string,
          role: (token.role as "user" | "admin" | undefined) ?? "user",
        },
      }),
    },
    pages: {
      signIn: "/sign-in",
    },
  };
}
