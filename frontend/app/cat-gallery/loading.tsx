export default function CatGalleryLoading() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="h-5 w-20 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
      <div className="mt-8 flex flex-col items-center gap-3">
        <div className="h-10 w-44 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
        <div className="h-5 w-80 max-w-full animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
        <div className="mt-5 h-11 w-full max-w-xl animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
        <div className="h-5 w-24 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
      </div>
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 12 }).map((_, index) => (
          <div key={index} className="flex flex-col items-center gap-2">
            <div className="aspect-square w-full animate-pulse rounded-3xl bg-muted motion-reduce:animate-none" />
            <div className="h-5 w-20 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
          </div>
        ))}
      </div>
    </main>
  )
}
