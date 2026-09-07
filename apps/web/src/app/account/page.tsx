import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DeleteAccountForm } from "./DeleteAccountForm";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Account</h1>
      <p className="text-zinc-400">Signed in as {session.user.email}.</p>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-red-400">Delete account</h2>
        <DeleteAccountForm />
      </div>
    </main>
  );
}
