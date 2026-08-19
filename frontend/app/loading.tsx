import { cn } from '@/lib/utils'

import styles from '@/components/home/home.module.css'

export default function Loading() {
  return (
    <div
      className={cn(styles['home-shell'], 'flex flex-1 flex-col bg-background')}
    >
      <section className={styles['home-hero']} aria-hidden="true">
        <div className={styles['home-hero__layout']}>
          <div className="space-y-6">
            <div className="h-8 w-64 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
            <div className="space-y-3">
              <div className="h-16 w-64 animate-pulse rounded-lg bg-muted sm:h-24 sm:w-96 motion-reduce:animate-none" />
              <div className="h-20 w-72 animate-pulse rounded-lg bg-rift/20 sm:h-28 sm:w-112 motion-reduce:animate-none" />
            </div>
            <div className="h-14 w-full max-w-xl animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="h-11 w-32 animate-pulse rounded-lg bg-rift/30 motion-reduce:animate-none" />
              <div className="h-11 w-36 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
            </div>
          </div>
          <div className="relative mx-auto aspect-square w-full max-w-xl">
            <div className="absolute inset-[8%] animate-pulse rounded-full border border-rift/30 bg-rift/5 motion-reduce:animate-none" />
            <div className="absolute inset-[27%] animate-pulse rounded-full bg-rift/5 shadow-panel motion-reduce:animate-none" />
            <div className="absolute inset-x-[12%] bottom-[4%] h-16 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
          </div>
        </div>
      </section>

      <section
        className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 px-6 py-12 sm:grid-cols-3"
        aria-hidden="true"
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-36 animate-pulse rounded-xl bg-muted motion-reduce:animate-none"
          />
        ))}
      </section>

      <section
        className="mx-auto w-full max-w-5xl px-6 py-16"
        aria-hidden="true"
      >
        <div className="mb-8 flex items-end justify-between gap-5 border-b border-grid-line pb-5">
          <div className="space-y-3">
            <div className="h-3 w-36 animate-pulse rounded bg-muted motion-reduce:animate-none" />
            <div className="h-10 w-44 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
            <div className="h-4 w-48 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          </div>
          <div className="h-9 w-32 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'relative aspect-[4/5] animate-pulse rounded-xl bg-muted motion-reduce:animate-none',
                i >= 4 && 'hidden sm:block',
              )}
            />
          ))}
        </div>
      </section>

      <section
        className="mx-auto w-full max-w-360 px-5 py-20 sm:px-8 lg:px-12"
        aria-hidden="true"
      >
        <div className="mb-6 h-4 w-56 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        <div className="grid overflow-hidden rounded-2xl border border-grid-line bg-surface lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <div className="aspect-[4/3] animate-pulse bg-muted motion-reduce:animate-none lg:aspect-auto lg:min-h-112" />
          <div className="flex min-h-72 flex-col justify-between gap-8 p-6 sm:p-8 lg:min-h-112 lg:p-10">
            <div className="space-y-6">
              <div className="h-4 w-36 animate-pulse rounded bg-muted motion-reduce:animate-none" />
              <div className="space-y-3">
                <div className="h-12 w-48 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
                <div className="h-4 w-32 animate-pulse rounded bg-muted motion-reduce:animate-none" />
              </div>
              <div className="h-16 w-full max-w-xl animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="h-11 w-28 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
              <div className="h-11 w-32 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
