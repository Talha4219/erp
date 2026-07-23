export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      <div className="skeleton-shimmer h-9 w-40 rounded-lg" />
      <div className="flex gap-2 border-b border-border/50 pb-0">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skeleton-shimmer h-8 w-28 rounded-t-lg" />
        ))}
      </div>
      <div className="space-y-5 rounded-xl border border-border/50 p-6">
        <div className="skeleton-shimmer h-6 w-48 rounded" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="skeleton-shimmer h-3 w-24 rounded" />
            <div className="skeleton-shimmer h-9 w-full rounded-lg" />
          </div>
        ))}
        <div className="skeleton-shimmer mt-4 h-10 w-32 rounded-lg" />
      </div>
    </div>
  )
}
