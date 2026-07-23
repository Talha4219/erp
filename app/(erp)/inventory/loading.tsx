export default function InventoryLoading() {
  return (
    <div className="space-y-5">
      <div className="skeleton-shimmer h-9 w-48 rounded-lg" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton-shimmer h-28 rounded-xl border border-border/50" />
        ))}
      </div>
      <div className="rounded-xl border border-border/50">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="border-b border-border/50 p-4 last:border-0">
            <div className="flex items-center gap-4">
              <div className="skeleton-shimmer h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="skeleton-shimmer h-4 w-3/5 rounded" />
                <div className="skeleton-shimmer h-3 w-2/5 rounded" />
              </div>
              <div className="skeleton-shimmer h-4 w-20 rounded" />
              <div className="skeleton-shimmer h-4 w-16 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
