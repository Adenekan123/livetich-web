export default function DashboardLoading() {
  return (
    <main
      className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
      aria-busy="true"
      aria-label="Loading dashboard"
    >
      <span className="sr-only">Loading dashboard</span>
      <div className="animate-pulse">
        <div className="h-9 w-72 rounded-lg bg-neutral-200" />
        <div className="mt-3 h-5 w-96 max-w-full rounded bg-neutral-100" />
        <div className="mt-8 h-28 rounded-2xl border border-neutral-200 bg-white" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)]">
          <div className="h-80 rounded-2xl border border-neutral-200 bg-white" />
          <div className="h-56 rounded-2xl border border-neutral-200 bg-white" />
        </div>
      </div>
    </main>
  );
}
