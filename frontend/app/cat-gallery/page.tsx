import Link from 'next/link'

import { CatGalleryBrowser } from '@/components/cats/cat-gallery-browser'
import { getCats } from '@/lib/api'

export default async function CatGalleryPage() {
  const cats = await getCats()

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <Link
        href="/"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← 返回首页
      </Link>

      <header className="mt-8 text-center">
        <h1 className="font-heading text-4xl text-foreground">猫咪百科</h1>
        <p className="mt-3 text-muted-foreground">
          从性格到生活习惯，找到最懂你的猫咪伙伴
        </p>
      </header>

      <CatGalleryBrowser cats={cats} />
    </main>
  )
}
