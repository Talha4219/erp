export default function ERPLoading() {
  return (
    <div className="space-y-6">
      <div className="skeleton-shimmer h-24 rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="skeleton-shimmer h-24 rounded-xl border border-border/50" />
        ))}
      </div>
      <div className="skeleton-shimmer h-72 rounded-xl" />
    </div>
  )
}
