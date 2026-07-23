export default function ProjectsLoading() {
  return (
    <div className="space-y-5">
      <div className="skeleton-shimmer h-9 w-40 rounded-lg" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border/50 p-4">
            <div className="flex items-center gap-3">
              <div className="skeleton-shimmer h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="skeleton-shimmer h-4 w-3/4 rounded" />
                <div className="skeleton-shimmer h-3 w-1/2 rounded" />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="skeleton-shimmer h-2 w-full rounded-full" />
              <div className="flex justify-between">
                <div className="skeleton-shimmer h-3 w-16 rounded" />
                <div className="skeleton-shimmer h-3 w-12 rounded" />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <div className="skeleton-shimmer h-6 w-16 rounded-full" />
              <div className="skeleton-shimmer h-6 w-20 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
