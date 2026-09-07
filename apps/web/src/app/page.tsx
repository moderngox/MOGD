import Link from "next/link";
import { Button } from "@mogd/ui";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">
        MOG<span className="align-super text-2xl">D</span>
      </h1>
      <p className="max-w-md text-zinc-400">
        Foundation build. Assessment, training, nutrition and adaptation land in later
        milestones.
      </p>
      <div className="flex gap-3">
        <Link href="/sign-in">
          <Button>Sign in</Button>
        </Link>
        <Link href="/sign-up">
          <Button variant="secondary">Create account</Button>
        </Link>
      </div>
    </main>
  );
}
