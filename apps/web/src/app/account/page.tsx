import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@mogd/db";
import { assessment } from "@mogd/domain";
import { Button } from "@mogd/ui";
import { DeleteAccountForm } from "./DeleteAccountForm";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const hasAssessment = (await assessment.getUserAssessment(getDb(), session.user.id)) !== null;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Account</h1>
      <p className="text-zinc-400">Signed in as {session.user.email}.</p>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Assessment</h2>
        <p className="text-sm text-zinc-400">
          {hasAssessment
            ? "Update your goals, body stats, training and nutrition answers."
            : "You haven't completed your assessment yet."}
        </p>
        <Link href={hasAssessment ? "/assessment?edit=1" : "/assessment"} className="self-start">
          <Button variant="outline">{hasAssessment ? "Edit assessment" : "Start assessment"}</Button>
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-red-400">Delete account</h2>
        <DeleteAccountForm />
      </div>
    </main>
  );
}
