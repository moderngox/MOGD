// Ambient augmentation for this package's own standalone typecheck.
// apps/web and apps/admin each carry an identical copy (see
// src/types/next-auth.d.ts) because TypeScript module augmentation does not
// propagate across separate, unreferenced tsconfig programs in this
// workspace-source-import setup.
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "user" | "admin";
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "user" | "admin";
  }
}
