import Image from 'next/image'
import Link from 'next/link'

import type { CatBreed } from '@/lib/types/cat'
import { cn } from '@/lib/utils'

interface CatCardProps {
  cat: CatBreed
  className?: string
}

export function CatCard({ cat, className }: CatCardProps) {
  return (
    <Link
      href={`/cats/${cat.id}`}
      className={cn('group focus-visible:outline-none', className)}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-3xl border-2 border-card bg-muted shadow-md transition-transform duration-300 group-hover:-translate-y-1 group-hover:shadow-lg group-focus-visible:-translate-y-1 group-focus-visible:ring-3 group-focus-visible:ring-ring/50 motion-reduce:transform-none motion-reduce:transition-none">
        <Image
          src={cat.image_url}
          alt={cat.name_zh}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover"
        />
      </div>
      <div className="mt-2 text-center">
        <p className="font-heading text-lg text-foreground">{cat.name_zh}</p>
        <p className="text-xs text-muted-foreground">{cat.name_en}</p>
      </div>
    </Link>
  )
}
