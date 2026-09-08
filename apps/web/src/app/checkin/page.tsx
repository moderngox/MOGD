import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@mogd/db";
import { assessment } from "@mogd/domain";
import { loadMediaEnv } from "@mogd/media";
import { AppleIcon, BottomNav, DumbbellIcon, HomeIcon, ProgressIcon, SidebarNav } from "@mogd/ui";
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

  const navItems = [
    { href: "/dashboard", label: "Today", icon: <HomeIcon /> },
    { href: "/program", label: "Training", icon: <DumbbellIcon /> },
    { href: "/checkin", label: "Nutrition", active: true, icon: <AppleIcon /> },
    { href: "/checkin", label: "Progress", icon: <ProgressIcon /> },
  ];

  return (
    <div className="flex min-h-screen">
      <SidebarNav items={navItems} />
      <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-8 py-10 pb-24 md:pb-10">
        <h1 className="font-display text-3xl font-semibold text-fg">Weekly check-in</h1>
        <CheckinForm photosAvailable={photosAvailable} />
      </main>

      <BottomNav items={navItems} />
    </div>
  );
}
