export default function Loading() {
  return (
    <div className="mx-auto flex h-[calc(100dvh-4rem)] w-full max-w-3xl flex-col px-6 py-6">
      <div className="h-4 w-20 animate-pulse rounded bg-muted" />
      <div className="mt-4 flex flex-col items-center gap-2">
        <div className="h-9 w-52 animate-pulse rounded-lg bg-muted" />
        <div className="h-5 w-72 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="mt-6 flex-1 space-y-4">
        <div className="flex justify-end">
          <div className="h-16 w-64 animate-pulse rounded-3xl bg-muted" />
        </div>
        <div className="flex justify-start">
          <div className="h-20 w-80 animate-pulse rounded-3xl bg-muted" />
        </div>
      </div>
      <div className="h-11 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
