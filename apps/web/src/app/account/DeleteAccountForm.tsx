"use client";

import { useState } from "react";
import { Button, Input } from "@mogd/ui";
import { deleteAccountAction } from "./actions";

const CONFIRM_PHRASE = "DELETE";

export function DeleteAccountForm() {
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      action={deleteAccountAction}
      onSubmit={() => setSubmitting(true)}
      className="flex flex-col gap-3 rounded-md border border-red-900/50 p-4"
    >
      <p className="text-sm text-zinc-400">
        This permanently deletes your profile, assessment, strategy, program, measurements,
        check-ins and progress photos. This cannot be undone.
      </p>
      <label className="flex flex-col gap-1 text-sm text-zinc-500">
        Type {CONFIRM_PHRASE} to confirm
        <Input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={CONFIRM_PHRASE}
        />
      </label>
      <Button
        type="submit"
        variant="destructive"
        disabled={confirmText !== CONFIRM_PHRASE || submitting}
      >
        {submitting ? "Deleting…" : "Permanently delete my account"}
      </Button>
    </form>
  );
}
