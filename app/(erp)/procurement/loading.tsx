export default function ProcurementLoading() {
  return (
    <div className="space-y-5">
      <div className="skeleton-shimmer h-9 w-56 rounded-lg" />
      <div className="flex gap-3">
        <div className="skeleton-shimmer h-20 flex-1 rounded-xl" />
        <div className="skeleton-shimmer h-20 flex-1 rounded-xl" />
        <div className="skeleton-shimmer h-20 flex-1 rounded-xl" />
      </div>
      <div className="rounded-xl border border-border/50">
        <div className="border-b border-border/50 p-4">
          <div className="flex gap-4">
            <div className="skeleton-shimmer h-5 w-28 rounded" />
            <div className="skeleton-shimmer h-5 w-36 rounded" />
            <div className="skeleton-shimmer h-5 w-24 rounded" />
            <div className="skeleton-shimmer h-5 w-20 rounded" />
            <div className="skeleton-shimmer h-5 w-32 rounded" />
          </div>
        </div>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="border-b border-border/50 p-4 last:border-0">
            <div className="flex gap-4">
              <div className="skeleton-shimmer h-4 w-28 rounded" />
              <div className="skeleton-shimmer h-4 w-36 rounded" />
              <div className="skeleton-shimmer h-4 w-24 rounded" />
              <div className="skeleton-shimmer h-4 w-20 rounded" />
              <div className="skeleton-shimmer h-4 w-32 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
