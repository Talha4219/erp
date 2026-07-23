export default function HRLoading() {
  return (
    <div className="space-y-5">
      <div className="skeleton-shimmer h-9 w-36 rounded-lg" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton-shimmer h-24 rounded-xl border border-border/50" />
        ))}
      </div>
      <div className="flex gap-2">
        <div className="skeleton-shimmer h-10 w-48 rounded-lg" />
        <div className="skeleton-shimmer h-10 w-36 rounded-lg" />
        <div className="skeleton-shimmer h-10 w-36 rounded-lg" />
      </div>
      <div className="rounded-xl border border-border/50">
        <div className="border-b border-border/50 p-4">
          <div className="flex gap-4">
            <div className="skeleton-shimmer h-5 w-20 rounded" />
            <div className="skeleton-shimmer h-5 w-36 rounded" />
            <div className="skeleton-shimmer h-5 w-24 rounded" />
            <div className="skeleton-shimmer h-5 w-28 rounded" />
            <div className="skeleton-shimmer h-5 w-20 rounded" />
            <div className="skeleton-shimmer h-5 w-24 rounded" />
          </div>
        </div>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="border-b border-border/50 p-4 last:border-0">
            <div className="flex gap-4">
              <div className="flex items-center gap-3">
                <div className="skeleton-shimmer h-8 w-8 rounded-full" />
                <div className="space-y-1.5">
                  <div className="skeleton-shimmer h-4 w-32 rounded" />
                  <div className="skeleton-shimmer h-3 w-20 rounded" />
                </div>
              </div>
              <div className="skeleton-shimmer h-4 w-24 rounded ml-auto" />
              <div className="skeleton-shimmer h-4 w-20 rounded" />
              <div className="skeleton-shimmer h-4 w-28 rounded" />
              <div className="skeleton-shimmer h-4 w-16 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
