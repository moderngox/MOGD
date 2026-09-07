export default function AdminDashboardPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-zinc-400">
        Users, active programs, exercise count, missing media, recent uploads and AI
        failures land here starting M2 (docs/ARCHITECTURE.md §20).
      </p>
    </div>
  );
}
