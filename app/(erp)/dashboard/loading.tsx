export default function DashboardLoading() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="skeleton-shimmer h-28 rounded-xl border border-border/50" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="skeleton-shimmer h-72 rounded-xl border border-border/50" />
        <div className="space-y-3">
          <div className="skeleton-shimmer h-5 w-36 rounded" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton-shimmer h-14 rounded-lg" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="skeleton-shimmer h-48 rounded-xl border border-border/50" />
        <div className="skeleton-shimmer h-48 rounded-xl border border-border/50" />
        <div className="skeleton-shimmer h-48 rounded-xl border border-border/50" />
      </div>
    </div>
  )
}
