"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Select } from "@mogd/ui";
import { getAssetUploadUrlAction, createDraftAssetAction, approveAssetAction, archiveAssetAction } from "./actions";

export interface ExerciseOption {
  id: string;
  name: string;
  canonicalId: string;
}

export interface AssetRow {
  id: string;
  type: "video" | "thumbnail";
  version: number;
  status: "draft" | "approved" | "archived";
  validationNotes: string | null;
  previewUrl: string | null;
}

export function MediaManager({
  exercises,
  selectedExerciseId,
  assets,
  mediaAvailable,
}: {
  exercises: ExerciseOption[];
  selectedExerciseId: string | null;
  assets: AssetRow[];
  mediaAvailable: boolean;
}) {
  const router = useRouter();
  const [assetType, setAssetType] = useState<"video" | "thumbnail">("video");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function selectExercise(id: string) {
    router.push(id ? `/media?exerciseId=${id}` : "/media");
  }

  async function handleUpload(file: File) {
    if (!selectedExerciseId) return;
    setUploading(true);
    setError(null);

    try {
      const extension = assetType === "thumbnail" ? "jpg" : "mp4";
      const result = await getAssetUploadUrlAction(selectedExerciseId, assetType, extension);
      if (!result.available || !result.uploadUrl || !result.objectKey) {
        setError("Media upload is not configured.");
        return;
      }

      const res = await fetch(result.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!res.ok) {
        setError("Upload to storage failed.");
        return;
      }

      await createDraftAssetAction({
        exerciseId: selectedExerciseId,
        type: assetType,
        objectKey: result.objectKey,
      });
      router.refresh();
    } catch {
      setError("Something went wrong uploading this asset.");
    } finally {
      setUploading(false);
    }
  }

  async function handleApprove(assetId: string) {
    await approveAssetAction(assetId);
    router.refresh();
  }

  async function handleArchive(assetId: string) {
    await archiveAssetAction(assetId);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <Select
        value={selectedExerciseId ?? ""}
        onChange={(e) => selectExercise(e.target.value)}
      >
        <option value="">Select an exercise…</option>
        {exercises.map((ex) => (
          <option key={ex.id} value={ex.id}>
            {ex.name} ({ex.canonicalId})
          </option>
        ))}
      </Select>

      {!selectedExerciseId ? (
        <p className="text-sm text-zinc-500">Select an exercise to manage its media.</p>
      ) : !mediaAvailable ? (
        <p className="text-sm text-zinc-500">
          R2 media storage isn&apos;t configured in this environment.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <Select
              value={assetType}
              onChange={(e) => setAssetType(e.target.value as "video" | "thumbnail")}
            >
              <option value="video">Video</option>
              <option value="thumbnail">Thumbnail</option>
            </Select>
            <label>
              <input
                type="file"
                accept={assetType === "video" ? "video/mp4" : "image/jpeg"}
                disabled={uploading}
                className="text-sm text-zinc-400"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleUpload(file);
                }}
              />
            </label>
            {uploading && <span className="text-sm text-zinc-500">Uploading…</span>}
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          {assets.length === 0 ? (
            <p className="text-sm text-zinc-500">No media uploaded for this exercise yet.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {assets.map((asset) => (
                <li key={asset.id} className="flex flex-col gap-2 border-t border-zinc-800 pt-3">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="font-medium">
                      {asset.type} v{asset.version}
                    </span>
                    <span
                      className={
                        asset.status === "approved"
                          ? "text-green-400"
                          : asset.status === "draft"
                            ? "text-yellow-400"
                            : "text-zinc-500"
                      }
                    >
                      {asset.status}
                    </span>
                  </div>

                  {asset.previewUrl && asset.type === "video" ? (
                    <video src={asset.previewUrl} controls className="max-w-sm rounded-md" />
                  ) : asset.previewUrl ? (
                    <img src={asset.previewUrl} alt="" className="max-w-sm rounded-md" />
                  ) : null}

                  <div className="flex gap-2">
                    {asset.status === "draft" && (
                      <Button onClick={() => handleApprove(asset.id)}>Approve &amp; publish</Button>
                    )}
                    {asset.status === "approved" && (
                      <Button variant="secondary" onClick={() => handleArchive(asset.id)}>
                        Unpublish
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
