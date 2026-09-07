import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@mogd/db";
import { assessment } from "@mogd/domain";
import { loadMediaEnv } from "@mogd/media";
import { SidebarNav } from "@mogd/ui";
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
    <div className="flex min-h-screen">
      <SidebarNav
        items={[
          { href: "/dashboard", label: "Today" },
          { href: "/program", label: "Training" },
          { href: "/checkin", label: "Nutrition", active: true },
          { href: "/checkin", label: "Progress" },
        ]}
      />
      <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-8 py-10">
        <h1 className="font-display text-3xl font-semibold text-fg">Weekly check-in</h1>
        <CheckinForm photosAvailable={photosAvailable} />
      </main>
    </div>
  );
}
