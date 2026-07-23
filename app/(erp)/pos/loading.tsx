export default function POSLoading() {
  return (
    <div className="flex h-[calc(100vh-7rem)] gap-3">
      <div className="flex flex-1 flex-col gap-3">
        <div className="skeleton-shimmer h-12 rounded-xl" />
        <div className="grid flex-1 grid-cols-3 gap-3">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="skeleton-shimmer rounded-xl" />
          ))}
        </div>
      </div>
      <div className="flex w-80 flex-col gap-3">
        <div className="skeleton-shimmer h-40 rounded-xl" />
        <div className="skeleton-shimmer h-32 rounded-xl" />
        <div className="skeleton-shimmer mt-auto h-14 rounded-xl" />
      </div>
    </div>
  )
}
