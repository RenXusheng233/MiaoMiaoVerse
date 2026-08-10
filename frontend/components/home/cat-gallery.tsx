import Image from "next/image";
import Link from "next/link";

import type { CatBreed } from "@/lib/types/cat";

interface CatGalleryProps {
  cats: CatBreed[];
}

export function CatGallery({ cats }: CatGalleryProps) {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-16">
      <div className="mb-8 text-center">
        <h2 className="font-heading text-3xl text-foreground">猫咪百科</h2>
        <p className="mt-2 text-muted-foreground">
          {cats.length} 个品种，总有一款适合你
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {cats.map((cat) => (
          <Link key={cat.id} href={`/cats/${cat.id}`} className="group">
            <div className="relative aspect-square w-full overflow-hidden rounded-3xl border-2 border-card shadow-md transition-transform duration-300 group-hover:-translate-y-1 group-hover:shadow-lg">
              <Image
                src={cat.image_url}
                alt={cat.name_zh}
                fill
                sizes="(max-width: 640px) 50vw, 25vw"
                className="object-cover"
              />
            </div>
            <div className="mt-2 text-center">
              <p className="font-heading text-lg text-foreground">{cat.name_zh}</p>
              <p className="text-xs text-muted-foreground">{cat.name_en}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
