import Link from 'next/link'

import { CatCard } from '@/components/cats/cat-card'
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
    <section className="mx-auto w-full max-w-5xl px-6 py-16">
      <div className="mb-8 text-center">
        <h2 className="font-heading text-3xl text-foreground">猫咪百科</h2>
        <p className="mt-2 text-muted-foreground">
          {cats.length} 个品种，总有一款适合你
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {homeCats.map((cat, index) => (
          <CatCard
            key={cat.id}
            cat={cat}
            className={cn(index >= 4 && 'hidden sm:block')}
          />
        ))}
      </div>
      <div className="mt-10 text-center">
        <Link href="/cat-gallery" className={buttonVariants({ size: 'lg' })}>
          查看更多
        </Link>
      </div>
    </section>
  )
}
