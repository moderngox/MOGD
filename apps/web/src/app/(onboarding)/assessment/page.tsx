import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@mogd/db";
import { assessment } from "@mogd/domain";
import { loadMediaEnv } from "@mogd/media";
import { AssessmentWizard } from "./AssessmentWizard";

export default async function AssessmentPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const existing = await assessment.getUserAssessment(getDb(), session.user.id);
  if (existing) {
    redirect("/dashboard");
  }

  const photosAvailable = loadMediaEnv() !== null;

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 p-8">
      <AssessmentWizard photosAvailable={photosAvailable} />
    </main>
  );
}
