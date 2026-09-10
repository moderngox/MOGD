import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminSidebar } from "@/components/AdminSidebar";
import { AdminBottomNav } from "@/components/AdminBottomNav";
import { SignOutButton } from "@/components/SignOutButton";
import { Wordmark } from "@mogd/ui";

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
      <main className="flex min-h-screen items-center justify-center bg-bg p-8 text-center">
        <p className="text-fg-secondary">Your account does not have admin access.</p>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-border bg-bg px-5 py-3 md:hidden">
          <Wordmark size="compact" />
          <SignOutButton />
        </div>

        <header className="hidden items-center justify-between gap-3 border-b border-border bg-bg px-8 py-3 md:flex">
          <span className="text-xs font-semibold uppercase tracking-wide text-fg-secondary">
            <span className="text-accent">MOGᴰ Admin</span> · {session.user.email}
          </span>
          <SignOutButton />
        </header>

        <main className="mx-auto w-full min-w-0 max-w-[1280px] flex-1 px-5 py-6 pb-24 md:px-8 md:pb-6">
          {children}
        </main>
      </div>

      <AdminBottomNav />
    </div>
  );
}
