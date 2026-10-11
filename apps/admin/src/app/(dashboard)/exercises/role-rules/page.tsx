import Link from "next/link";
import { getDb } from "@mogd/db";
import { training } from "@mogd/domain";
import { RoleRulesForm } from "./RoleRulesForm";

export default async function RoleRulesPage() {
  const db = getDb();
  const [current, revisions] = await Promise.all([
    training.getCurrentRoleRules(db),
    training.listRoleRulesRevisions(db),
  ]);

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div>
        <Link href="/exercises" className="text-sm text-accent hover:underline">
          ← Exercises
        </Link>
        <h1 className="font-display text-3xl font-semibold text-fg">Role rules</h1>
        <p className="text-sm text-fg-secondary">
          The numbers behind main, accessory, superset and finisher sessions. Changes apply the next time a
          program is generated; existing programs keep the rules they were built with.
        </p>
      </div>
      <RoleRulesForm
        initial={current.rules}
        currentRevisionId={current.revisionId}
        revisions={revisions.map((r) => ({
          id: r.id,
          createdAt: r.createdAt.toISOString(),
          createdByEmail: r.createdByEmail,
          note: r.note,
        }))}
      />
    </div>
  );
}
