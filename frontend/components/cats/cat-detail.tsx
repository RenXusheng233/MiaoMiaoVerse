import Image from "next/image";
import Link from "next/link";

import { RadarChart } from "@/components/cats/radar-chart";
import type { CatBreed } from "@/lib/types/cat";

export function CatDetail({ cat }: { cat: CatBreed }) {
  return (
    <article className="mx-auto w-full max-w-3xl px-6 py-10">
      <Link
        href="/"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← 返回首页
      </Link>

      <div className="mt-6 flex flex-col gap-8 sm:flex-row">
        <div className="relative aspect-square w-full max-w-xs shrink-0 overflow-hidden rounded-4xl border-4 border-card shadow-xl">
          <Image
            src={cat.image_url}
            alt={cat.name_zh}
            fill
            sizes="(max-width: 640px) 100vw, 320px"
            className="object-cover"
            priority
          />
        </div>

        <div className="flex-1 space-y-4">
          <h1 className="font-heading text-3xl text-foreground">
            {cat.name_zh}
            <span className="ml-2 text-base text-muted-foreground">
              {cat.name_en}
            </span>
          </h1>
          <p className="text-muted-foreground">&ldquo;{cat.quote}&rdquo;</p>

          <div className="flex flex-wrap gap-2">
            {cat.meme_tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground"
              >
                {tag}
              </span>
            ))}
          </div>

          <dl className="space-y-1 text-sm text-muted-foreground">
            <div>
              🌍 起源地：<span className="text-foreground">{cat.origin}</span>
            </div>
            <div>
              📏 体型：<span className="text-foreground">{cat.size}</span>
            </div>
            <div>
              🐾 毛发：<span className="text-foreground">{cat.coat}</span>
            </div>
          </dl>

          <div className="flex flex-wrap gap-2">
            {cat.suitable_owners.map((owner) => (
              <span
                key={owner}
                className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm text-primary"
              >
                {owner}
              </span>
            ))}
          </div>
        </div>
      </div>

      <section className="mt-12 text-center">
        <h2 className="font-heading text-2xl text-foreground">全方位雷达图</h2>
        <div className="mt-4">
          <RadarChart scores={cat.scores} />
        </div>
      </section>
    </article>
  );
}
