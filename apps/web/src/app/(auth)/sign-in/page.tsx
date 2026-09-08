import { redirect } from "next/navigation";
import Link from "next/link";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { isLockedOut, recordFailedAttempt } from "@mogd/shared/auth";
import { Button, Input } from "@mogd/ui";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error: errorParam } = await searchParams;

  async function signInAction(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    const rateLimitKey = `web:signin:${email}`;

    if (isLockedOut(rateLimitKey)) {
      redirect("/sign-in?error=rate_limited");
    }

    try {
      await signIn("credentials", {
        email,
        password: formData.get("password"),
        redirectTo: "/dashboard",
      });
    } catch (error) {
      if (error instanceof AuthError) {
        recordFailedAttempt(rateLimitKey);
        redirect(`/sign-in?error=${error.type}`);
      }
      throw error;
    }
  }

  return (
    <main className="relative mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-8">
      <p className="absolute left-1/2 top-16 -translate-x-1/2 text-4xl font-semibold tracking-tight">
        MOG<span className="align-super text-2xl">D</span>
      </p>
      <h1 className="text-2xl font-semibold">Sign in</h1>
      {errorParam === "rate_limited" ? (
        <p className="text-sm text-red-400">Too many attempts. Try again in a few minutes.</p>
      ) : errorParam ? (
        <p className="text-sm text-red-400">Invalid email or password.</p>
      ) : null}
      <form action={signInAction} className="flex flex-col gap-3">
        <Input type="email" name="email" placeholder="Email" required autoComplete="email" />
        <Input
          type="password"
          name="password"
          placeholder="Password"
          required
          autoComplete="current-password"
        />
        <Button type="submit">Sign in</Button>
      </form>
      <p className="text-center text-sm text-fg-secondary">
        Don&apos;t have an account?{" "}
        <Link href="/sign-up" className="text-accent hover:text-accent-hover">
          Create one
        </Link>
      </p>
    </main>
  );
}
