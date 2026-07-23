export default function CRMLoading() {
  return (
    <div className="space-y-5">
      <div className="skeleton-shimmer h-9 w-28 rounded-lg" />
      <div className="flex gap-2">
        <div className="skeleton-shimmer h-10 w-48 rounded-lg" />
        <div className="skeleton-shimmer h-10 w-32 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border/50 p-4">
            <div className="skeleton-shimmer mb-3 h-5 w-24 rounded" />
            <div className="space-y-2">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="skeleton-shimmer h-16 rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
