import { getDb } from "@mogd/db";
import { exercises } from "@mogd/domain";
import { loadMediaEnv, exerciseAssetPublicUrl } from "@mogd/media";
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
  const assetsWithPreview = assets.map((asset) => ({
    ...asset,
    previewUrl:
      env && (asset.type === "video" || asset.type === "thumbnail")
        ? exerciseAssetPublicUrl(env, {
            exerciseId: asset.exerciseId,
            assetId: asset.id,
            type: asset.type,
            extension: asset.objectKey.endsWith(".jpg") ? "jpg" : "mp4",
          })
        : null,
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
