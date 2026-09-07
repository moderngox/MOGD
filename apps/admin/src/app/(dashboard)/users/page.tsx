export default function AdminUsersPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Users</h1>
      <p className="text-zinc-400">
        Read-only inspection of profiles, assessments, strategy, programs,
        measurements and check-ins lands in M1+ (docs/ARCHITECTURE.md §20).
      </p>
    </div>
  );
}
