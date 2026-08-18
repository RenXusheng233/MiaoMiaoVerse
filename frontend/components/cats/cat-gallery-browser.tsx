'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'

import { CatCard } from '@/components/cats/cat-card'
import { Input } from '@/components/ui/input'
import { filterAndSortCats } from '@/lib/cat-gallery'
import type { CatBreed } from '@/lib/types/cat'

export function CatGalleryBrowser({ cats }: { cats: CatBreed[] }) {
  const [query, setQuery] = useState('')
  const filteredCats = filterAndSortCats(cats, query)

  return (
    <section className="mt-8">
      <div className="mx-auto max-w-xl">
        <label htmlFor="breed-search" className="sr-only">
          搜索猫咪品种
        </label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="breed-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="输入中文或英文品种名"
            className="h-11 rounded-full bg-card pr-4 pl-11 shadow-sm"
            autoComplete="off"
          />
        </div>
      </div>

      <p
        className="mt-5 text-center text-sm text-muted-foreground"
        aria-live="polite"
      >
        {query.trim()
          ? `找到 ${filteredCats.length} 个品种`
          : `共 ${filteredCats.length} 个品种`}
      </p>

      {filteredCats.length > 0 ? (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filteredCats.map((cat) => (
            <CatCard key={cat.id} cat={cat} />
          ))}
        </div>
      ) : (
        <div className="mt-16 rounded-3xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
          <p className="font-heading text-xl text-foreground">
            没有找到这个品种
          </p>
          <p className="mt-2 text-sm text-muted-foreground">换个关键词试试</p>
        </div>
      )}
    </section>
  )
}
