'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight, CalendarDays, RefreshCw, Sparkles } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getRandomCat } from '@/lib/api'
import type { DailyCatResponse } from '@/lib/types/cat'

const IMAGE_PRELOAD_TIMEOUT_MS = 8000

interface DailyCatWidgetProps {
  initialData: DailyCatResponse
}

interface DailyCatPanelContentProps {
  data: DailyCatResponse
  onReroll: () => void
  isLoading: boolean
}

/** Warm the browser cache for an image URL; resolves when loaded (or timed out). */
function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    // window.Image (DOM constructor) — the bare `Image` name is shadowed by
    // the next/image import above and cannot be constructed.
    const img = new window.Image()
    img.onload = () => resolve()
    img.onerror = () => resolve() // image failure must not block the swap
    img.src = url
  })
}

export function DailyCatWidget({ initialData }: DailyCatWidgetProps) {
  const [data, setData] = useState(initialData)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const shouldReduceMotion = useReducedMotion()

  async function handleReroll() {
    setIsLoading(true)
    setError(null)
    try {
      const next = await getRandomCat(data.breed.id)
      // Swap content only after the new image is ready, so the caption and
      // the picture change together (no blank-image window). Timeout keeps
      // the swap from hanging on a slow image.
      await Promise.race([
        preloadImage(next.breed.image_url),
        new Promise((resolve) => setTimeout(resolve, IMAGE_PRELOAD_TIMEOUT_MS)),
      ])
      setData(next)
    } catch {
      setError('换猫失败，请稍后重试')
    } finally {
      setIsLoading(false)
    }
  }

  const panelContent = (
    <DailyCatPanelContent
      data={data}
      isLoading={isLoading}
      onReroll={handleReroll}
    />
  )

  return (
    <section
      aria-labelledby="daily-cat-title"
      className="mx-auto w-full max-w-360 px-5 py-20 sm:px-8 lg:px-12"
    >
      <div className="mb-6 flex items-center gap-3 font-mono text-[0.68rem] font-medium tracking-[0.2em] text-signal-secondary uppercase">
        <Sparkles aria-hidden="true" className="size-4" />
        Daily transmission / 03
      </div>
      <div className="overflow-hidden rounded-2xl border border-grid-line bg-surface shadow-panel">
        {shouldReduceMotion ? (
          panelContent
        ) : (
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={data.breed.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
            >
              {panelContent}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
      {error ? (
        <p aria-live="polite" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  )
}

function DailyCatPanelContent({
  data,
  onReroll,
  isLoading,
}: DailyCatPanelContentProps) {
  return (
    <div className="grid min-w-0 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
      <div className="relative aspect-[4/3] min-h-72 overflow-hidden border-b border-grid-line lg:aspect-auto lg:min-h-112 lg:border-r lg:border-b-0">
        <Link
          href={`/cats/${data.breed.id}`}
          className="group relative block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal"
        >
          <Image
            src={data.breed.image_url}
            alt={data.breed.name_zh}
            fill
            sizes="(max-width: 1024px) 100vw, 45vw"
            className="object-cover transition-transform duration-300 motion-safe:group-hover:scale-[1.03] motion-safe:group-focus-visible:scale-[1.03] motion-reduce:transition-none"
            priority
          />
          <span className="absolute inset-x-5 top-5 flex items-center justify-between font-mono text-[0.65rem] tracking-[0.16em] text-overlay-foreground/80 uppercase drop-shadow-sm">
            <span>MMV / 03</span>
            <span>Live archive</span>
          </span>
        </Link>
      </div>
      <div className="flex min-h-72 flex-col justify-between gap-8 p-6 sm:p-8 lg:min-h-112 lg:p-10">
        <div className="space-y-7">
          <div className="flex items-center gap-2 font-mono text-xs tracking-[0.12em] text-muted-foreground">
            <CalendarDays aria-hidden="true" className="size-4 text-signal" />
            <time dateTime={data.date}>{data.date}</time>
          </div>
          <div>
            <p className="mb-3 font-mono text-[0.68rem] tracking-[0.18em] text-signal-secondary uppercase">
              Today&apos;s specimen
            </p>
            <h2
              id="daily-cat-title"
              className="font-heading text-4xl leading-none tracking-tight text-foreground sm:text-5xl"
            >
              {data.breed.name_zh}
            </h2>
            <p className="mt-3 font-mono text-sm tracking-[0.14em] text-muted-foreground uppercase">
              {data.breed.name_en}
            </p>
          </div>
          <blockquote className="max-w-xl border-l-2 border-signal pl-4 text-base leading-8 text-muted-foreground sm:text-lg">
            &ldquo;{data.breed.quote}&rdquo;
          </blockquote>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            onClick={onReroll}
            disabled={isLoading}
            aria-busy={isLoading}
            size="lg"
            className="min-h-11"
          >
            <RefreshCw
              aria-hidden="true"
              className={cn(
                'size-4 motion-reduce:animate-none',
                isLoading && 'motion-safe:animate-spin',
              )}
            />
            {isLoading ? '召唤中…' : '换一只'}
          </Button>
          <Link
            href={`/cats/${data.breed.id}`}
            className={cn(
              buttonVariants({ variant: 'outline', size: 'lg' }),
              'min-h-11',
            )}
          >
            查看详情
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  )
}
