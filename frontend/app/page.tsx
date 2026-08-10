import { HeroSection } from "@/components/home/hero-section";
import { QuickLinksSection } from "@/components/home/quick-links-section";
import { DailyCatWidget } from "@/components/home/daily-cat-widget";
import { getDailyCat } from "@/lib/api";

export default async function Home() {
  const dailyCat = await getDailyCat();

  return (
    <div className="flex flex-1 flex-col">
      <HeroSection cat={dailyCat.breed} />
      <QuickLinksSection />
      <DailyCatWidget initialData={dailyCat} />
    </div>
  );
}
