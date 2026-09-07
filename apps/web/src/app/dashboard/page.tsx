import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { Button } from "@mogd/ui";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-zinc-400">
        Signed in as {session.user.email}. Strategy, nutrition targets and weekly
        workouts land in later milestones.
      </p>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <Button variant="secondary" type="submit">
          Sign out
        </Button>
      </form>
    </main>
  );
}
