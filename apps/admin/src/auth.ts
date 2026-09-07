import NextAuth from "next-auth";
import { getDb } from "@mogd/db";
import { buildAuthConfig } from "@mogd/shared/auth";

export const { handlers, auth, signIn, signOut } = NextAuth(buildAuthConfig(getDb()));
