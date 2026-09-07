export default function AdminMediaPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Media</h1>
      <p className="text-zinc-400">
        Select exercise → upload reviewed MP4 → preview → approve → publish
        lands in M2. Generation stays external and manual — no Seedance
        runtime integration here (docs/ARCHITECTURE.md §20, CLAUDE.md rule 7).
      </p>
    </div>
  );
}
