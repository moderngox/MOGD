import { redirect } from "next/navigation";
import Link from "next/link";
import { getDb } from "@mogd/db";
import { registerUser, EmailAlreadyRegisteredError, isLockedOut, recordFailedAttempt } from "@mogd/shared/auth";
import { signIn } from "@/auth";
import { Button, Input } from "@mogd/ui";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error: errorParam } = await searchParams;

  async function signUpAction(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    const rateLimitKey = `web:signup:${email}`;

    if (isLockedOut(rateLimitKey)) {
      redirect("/sign-up?error=rate_limited");
    }

    try {
      await registerUser(getDb(), {
        email,
        password: String(formData.get("password") ?? ""),
      });
    } catch (error) {
      recordFailedAttempt(rateLimitKey);
      if (error instanceof EmailAlreadyRegisteredError) {
        redirect("/sign-up?error=email_taken");
      }
      redirect("/sign-up?error=invalid");
    }

    await signIn("credentials", {
      email,
      password: formData.get("password"),
      redirectTo: "/dashboard",
    });
  }

  return (
    <main className="relative mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-8">
      <p className="absolute left-1/2 top-16 -translate-x-1/2 text-4xl font-semibold tracking-tight">
        MOG<span className="align-super text-2xl">D</span>
      </p>
      <h1 className="text-2xl font-semibold">Create account</h1>
      {errorParam === "email_taken" ? (
        <p className="text-sm text-red-400">An account with this email already exists.</p>
      ) : errorParam === "rate_limited" ? (
        <p className="text-sm text-red-400">Too many attempts. Try again in a few minutes.</p>
      ) : errorParam ? (
        <p className="text-sm text-red-400">
          Could not create account. Password must be at least 8 characters.
        </p>
      ) : null}
      <form action={signUpAction} className="flex flex-col gap-3">
        <Input type="email" name="email" placeholder="Email" required autoComplete="email" />
        <Input
          type="password"
          name="password"
          placeholder="Password (min. 8 characters)"
          required
          minLength={8}
          autoComplete="new-password"
        />
        <Button type="submit">Create account</Button>
      </form>
      <p className="text-center text-sm text-fg-secondary">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-accent hover:text-accent-hover">
          Sign in
        </Link>
      </p>
    </main>
  );
}
