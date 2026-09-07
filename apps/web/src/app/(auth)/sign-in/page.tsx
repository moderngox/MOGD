import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { Button, Input } from "@mogd/ui";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error: errorParam } = await searchParams;

  async function signInAction(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: "/dashboard",
      });
    } catch (error) {
      if (error instanceof AuthError) {
        redirect(`/sign-in?error=${error.type}`);
      }
      throw error;
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      {errorParam ? (
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
    </main>
  );
}
