import Link from "next/link";
import { getDb } from "@mogd/db";
import { safety } from "@mogd/domain";
import { RestrictionsManager } from "./RestrictionsManager";

export default async function RestrictionsPage() {
  const db = getDb();
  const categories = await safety.listRestrictionCategories(db);
  const rows = await Promise.all(
    categories.map(async (category) => ({
      id: category.id,
      key: category.key,
      label: category.label,
      ...(await safety.getRestrictionUsage(db, category.key)),
    })),
  );

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div>
        <Link href="/exercises" className="text-sm text-accent hover:underline">
          ← Exercises
        </Link>
        <h1 className="font-display text-3xl font-semibold text-fg">Restrictions</h1>
        <p className="text-sm text-fg-secondary">
          The categories that connect what an athlete reports to the exercises that are unsuitable for it. Add only
          categories that have been reviewed: this is not a clinical list, and nothing is filtered until you add one. Tick a
          category on an exercise (Safety) to keep it away from athletes who report it. A category in use cannot be
          deleted.
        </p>
      </div>
      <RestrictionsManager rows={rows} />
    </div>
  );
}
