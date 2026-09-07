import { getDb } from "@mogd/db";
import { exercises } from "@mogd/domain";
import { loadMediaEnv } from "@mogd/media";
import { MediaManager } from "./MediaManager";

export default async function AdminMediaPage({
  searchParams,
}: {
  searchParams: Promise<{ exerciseId?: string }>;
}) {
  const { exerciseId } = await searchParams;
  const db = getDb();

  const exerciseList = await exercises.listExercises(db);
  const selected = exerciseId ? await exercises.getExerciseById(db, exerciseId) : null;

  const env = loadMediaEnv();
  const assets = selected ? await exercises.listAssetsForExercise(db, selected.id) : [];
  // Build the preview URL from the asset's own stored objectKey — never
  // recompute a key from the DB row's id. The uploaded object's key was
  // built at upload time from a *different* random id (baked into the R2
  // path before the draft row existed), so re-deriving it from asset.id
  // here would silently point at an object that doesn't exist.
  const assetsWithPreview = assets.map((asset) => ({
    ...asset,
    previewUrl: env ? `${env.R2_EXERCISE_MEDIA_PUBLIC_BASE_URL}/${asset.objectKey}` : null,
  }));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Media</h1>
      <p className="text-sm text-zinc-500">
        Select exercise → upload reviewed MP4/thumbnail → preview → approve → publish.
        Generation stays external and manual (docs/ARCHITECTURE.md §20, CLAUDE.md rule 7).
      </p>
      <MediaManager
        exercises={exerciseList.map((e) => ({ id: e.id, name: e.name, canonicalId: e.canonicalId }))}
        selectedExerciseId={selected?.id ?? null}
        assets={assetsWithPreview}
        mediaAvailable={env !== null}
      />
    </div>
  );
}
