import Image from 'next/image'
import Link from 'next/link'

import type { CatBreed } from '@/lib/types/cat'
import { cn } from '@/lib/utils'

interface HomeCatCardProps {
  cat: CatBreed
  className?: string
}

export function HomeCatCard({ cat, className }: HomeCatCardProps) {
  return (
    <Link
      href={`/cats/${cat.id}`}
      className={cn(
        'group block overflow-hidden rounded-xl border border-grid-line bg-surface shadow-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        className,
      )}
    >
      <div className="relative aspect-[4/5] overflow-hidden">
        <Image
          src={cat.image_url}
          alt=""
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover transition-transform duration-200 motion-safe:group-hover:scale-105 motion-safe:group-focus-visible:scale-105 motion-reduce:transition-none"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-4 inset-y-4 overflow-hidden"
        >
          <span className="absolute inset-x-0 top-0 h-full opacity-0 transition-[transform,opacity] duration-700 ease-out motion-safe:group-hover:translate-y-full motion-safe:group-hover:opacity-100 motion-safe:group-focus-visible:translate-y-full motion-safe:group-focus-visible:opacity-100 motion-reduce:transition-none">
            <span className="absolute inset-x-0 top-0 h-px bg-signal" />
          </span>
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-surface/95 px-3 py-3">
          <p className="font-heading text-base font-semibold text-foreground">
            {cat.name_zh}
          </p>
          <p className="mt-0.5 text-xs tracking-wide text-muted-foreground">
            {cat.name_en}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            起源 · {cat.origin}
          </p>
        </div>
      </div>
    </Link>
  )
}
