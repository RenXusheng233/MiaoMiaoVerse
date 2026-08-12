export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="h-9 w-52 animate-pulse rounded-lg bg-muted" />
        <div className="h-5 w-72 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,360px)_1fr]">
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      </div>
    </div>
  )
}
