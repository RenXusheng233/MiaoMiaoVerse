import { CatGallery } from '@/components/home/cat-gallery'
import { DailyCatWidget } from '@/components/home/daily-cat-widget'
import { HeroSection } from '@/components/home/hero-section'
import { QuickLinksSection } from '@/components/home/quick-links-section'
import { getCats, getDailyCat } from '@/lib/api'

export default async function Home() {
  const [dailyCat, cats] = await Promise.all([getDailyCat(), getCats()])

  return (
    <main className="flex flex-1 flex-col">
      <HeroSection cat={dailyCat.breed} />
      <QuickLinksSection />
      <CatGallery cats={cats} />
      <DailyCatWidget initialData={dailyCat} />
    </main>
  )
}
