import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminSidebar } from "@/components/AdminSidebar";

/**
 * Server-side admin authorization gate for every route under this group.
 * The role check always reads session.user.role, which itself always comes
 * from a fresh database read in the auth session callback — never a
 * client-supplied claim (see docs/ARCHITECTURE.md §20, CLAUDE.md rule 10).
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/sign-in");
  }

  if (session.user.role !== "admin") {
    return (
      <main className="flex min-h-screen items-center justify-center p-8 text-center">
        <p className="text-zinc-400">
          Your account does not have admin access.
        </p>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <div className="flex-1 p-8">{children}</div>
    </div>
  );
}
