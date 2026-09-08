import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@mogd/db";
import { assessment } from "@mogd/domain";
import { loadMediaEnv } from "@mogd/media";
import { AssessmentWizard } from "./AssessmentWizard";

export default async function AssessmentPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const { edit } = await searchParams;
  const db = getDb();
  const existing = await assessment.getUserAssessment(db, session.user.id);

  // Editing re-opens the wizard pre-filled with the completed assessment
  // (see AssessmentWizard's initialDraft prop). Anyone else hitting this
  // route after finishing onboarding still gets bounced to the dashboard —
  // docs/PRODUCT.md: the dashboard is the home once an assessment exists.
  if (existing && edit !== "1") {
    redirect("/dashboard");
  }

  const draft = existing
    ? { step: 0, formState: (await assessment.getAssessmentFormState(db, session.user.id)) ?? {} }
    : await assessment.getDraft(db, session.user.id);
  const photosAvailable = loadMediaEnv() !== null;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 p-8 py-16">
      <AssessmentWizard photosAvailable={photosAvailable} initialDraft={draft} />
    </main>
  );
}
