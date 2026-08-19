import Link from 'next/link'

import { HomeCatCard } from '@/components/home/home-cat-card'
import { buttonVariants } from '@/components/ui/button'
import { selectHomeCats } from '@/lib/cat-gallery'
import type { CatBreed } from '@/lib/types/cat'
import { cn } from '@/lib/utils'

interface CatGalleryProps {
  cats: CatBreed[]
}

export function CatGallery({ cats }: CatGalleryProps) {
  const homeCats = selectHomeCats(cats)

  return (
    <section className="archive-section mx-auto w-full max-w-5xl px-6 py-16">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Feline Archive
          </p>
          <h2 className="mt-2 font-heading text-3xl text-foreground">
            猫咪百科档案
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            共 {cats.length} 个品种
          </p>
        </div>
        <Link
          href="/cat-gallery"
          className={cn(
            buttonVariants({ variant: 'outline', size: 'sm' }),
            'shrink-0 border-border bg-transparent text-foreground',
          )}
        >
          查看完整百科
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {homeCats.map((cat, index) => (
          <HomeCatCard
            key={cat.id}
            cat={cat}
            className={cn(index >= 4 && 'hidden sm:block')}
          />
        ))}
      </div>
    </section>
  )
}
