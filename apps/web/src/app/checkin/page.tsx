import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@mogd/db";
import { assessment } from "@mogd/domain";
import { loadMediaEnv } from "@mogd/media";
import { CheckinForm } from "./CheckinForm";

export default async function CheckinPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const summary = await assessment.getUserAssessment(getDb(), session.user.id);
  if (!summary) {
    redirect("/assessment");
  }

  const photosAvailable = loadMediaEnv() !== null;

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Weekly check-in</h1>
      <CheckinForm photosAvailable={photosAvailable} />
    </main>
  );
}
