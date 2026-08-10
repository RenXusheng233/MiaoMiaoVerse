export default function Loading() {
  return (
    <div className="flex flex-1 flex-col">
      {/* hero 占位 */}
      <div className="flex h-[90vh] min-h-140 w-full flex-col items-center justify-center gap-5 px-6">
        <div className="h-40 w-40 animate-pulse rounded-full bg-muted sm:h-56 sm:w-56" />
        <div className="h-11 w-72 animate-pulse rounded-xl bg-muted" />
        <div className="h-5 w-80 animate-pulse rounded-md bg-muted" />
      </div>
      {/* daily cat 占位 */}
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-6 py-16 text-center">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="aspect-square w-64 animate-pulse rounded-4xl bg-muted sm:w-80" />
        <div className="h-7 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-5 w-72 animate-pulse rounded-md bg-muted" />
        <div className="h-11 w-28 animate-pulse rounded-full bg-muted" />
      </div>
    </div>
  );
}
