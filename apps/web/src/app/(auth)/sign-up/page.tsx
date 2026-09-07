import { redirect } from "next/navigation";
import { getDb } from "@mogd/db";
import { registerUser, EmailAlreadyRegisteredError } from "@mogd/shared/auth";
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
    try {
      await registerUser(getDb(), {
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
      });
    } catch (error) {
      if (error instanceof EmailAlreadyRegisteredError) {
        redirect("/sign-up?error=email_taken");
      }
      redirect("/sign-up?error=invalid");
    }

    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/dashboard",
    });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">Create account</h1>
      {errorParam === "email_taken" ? (
        <p className="text-sm text-red-400">An account with this email already exists.</p>
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
    </main>
  );
}
