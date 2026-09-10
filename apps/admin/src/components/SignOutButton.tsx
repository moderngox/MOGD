import { signOut } from "@/auth";
import { PowerIcon } from "@mogd/ui";

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/sign-in" });
}

/** Same icon-only treatment as apps/web's dashboard sign-out control. */
export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={signOutAction} className={className}>
      <button
        type="submit"
        aria-label="Sign out"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-elevated text-fg-secondary transition-colors hover:border-border-strong hover:text-status-warning"
      >
        <PowerIcon className="h-5 w-5" />
      </button>
    </form>
  );
}
