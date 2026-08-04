type AppRouteLoadingProps = {
  roleLabel: string;
};

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl bg-slate-200/80 ${className}`} />;
}

export function AppRouteLoading({ roleLabel }: AppRouteLoadingProps) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <div className="flex min-h-screen">
        <aside className="hidden w-[248px] shrink-0 bg-[linear-gradient(180deg,#08163a_0%,#0b1d4d_48%,#091126_100%)] px-4 py-5 text-white lg:block">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-sm font-black text-blue-700 shadow-lg">
              M
            </div>
            <div className="space-y-1">
              <SkeletonBlock className="h-4 w-24 bg-white/20" />
              <SkeletonBlock className="h-3 w-20 bg-white/10" />
            </div>
          </div>

          <div className="mt-10 space-y-3">
            {Array.from({ length: 7 }).map((_, index) => (
              <SkeletonBlock
                key={index}
                className={index === 1 ? "h-11 w-full bg-white/18" : "h-11 w-full bg-white/10"}
              />
            ))}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/85 px-4 py-3 backdrop-blur-xl lg:px-6">
            <div className="flex items-center gap-3">
              <SkeletonBlock className="h-10 flex-1 max-w-xl" />
              <SkeletonBlock className="hidden h-8 w-28 sm:block" />
              <SkeletonBlock className="h-10 w-10 rounded-full" />
              <SkeletonBlock className="h-10 w-10 rounded-full" />
              <SkeletonBlock className="h-10 w-40 rounded-full" />
            </div>
          </header>

          <main className="space-y-5 px-4 py-5 md:px-5 lg:px-6 lg:py-6 xl:px-8 2xl:px-10">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <SkeletonBlock className="h-10 w-56" />
                <SkeletonBlock className="h-5 w-80 max-w-full" />
              </div>
              <div className="inline-flex w-fit items-center rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                Loading {roleLabel} workspace...
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <SkeletonBlock className="h-4 w-24" />
                  <SkeletonBlock className="mt-4 h-9 w-16" />
                  <SkeletonBlock className="mt-3 h-4 w-28" />
                </div>
              ))}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="grid gap-3 md:grid-cols-3">
                <SkeletonBlock className="h-11 w-full" />
                <SkeletonBlock className="h-11 w-full" />
                <SkeletonBlock className="h-11 w-full" />
              </div>

              <div className="mt-5 space-y-3">
                {Array.from({ length: 7 }).map((_, index) => (
                  <div key={index} className="grid gap-3 rounded-2xl border border-slate-100 px-4 py-4 lg:grid-cols-[1.3fr_1fr_1fr_1fr_140px]">
                    <SkeletonBlock className="h-5 w-4/5" />
                    <SkeletonBlock className="h-5 w-full" />
                    <SkeletonBlock className="h-5 w-full" />
                    <SkeletonBlock className="h-5 w-3/4" />
                    <SkeletonBlock className="h-10 w-full rounded-xl" />
                  </div>
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
