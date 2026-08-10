"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getRandomCat } from "@/lib/api";
import type { DailyCatResponse } from "@/lib/types/cat";

const IMAGE_PRELOAD_TIMEOUT_MS = 8000;

interface DailyCatWidgetProps {
  initialData: DailyCatResponse;
}

/** Warm the browser cache for an image URL; resolves when loaded (or timed out). */
function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    // window.Image (DOM constructor) — the bare `Image` name is shadowed by
    // the next/image import above and cannot be constructed.
    const img = new window.Image();
    img.onload = () => resolve();
    img.onerror = () => resolve(); // image failure must not block the swap
    img.src = url;
  });
}

export function DailyCatWidget({ initialData }: DailyCatWidgetProps) {
  const [data, setData] = useState(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReroll() {
    setIsLoading(true);
    setError(null);
    try {
      const next = await getRandomCat(data.breed.id);
      // Swap content only after the new image is ready, so the caption and
      // the picture change together (no blank-image window). Timeout keeps
      // the swap from hanging on a slow image.
      await Promise.race([
        preloadImage(next.breed.image_url),
        new Promise((resolve) => setTimeout(resolve, IMAGE_PRELOAD_TIMEOUT_MS)),
      ]);
      setData(next);
    } catch {
      setError("换猫失败，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-6 py-16 text-center">
      <h2 className="font-heading text-3xl text-foreground">今日明星猫咪</h2>
      <div className="relative aspect-square w-64 overflow-hidden rounded-4xl border-4 border-card shadow-xl sm:w-80">
        <Link href={`/cats/${data.breed.id}`} className="relative block h-full w-full">
          <Image
            src={data.breed.image_url}
            alt={data.breed.name_zh}
            fill
            sizes="(max-width: 640px) 256px, 320px"
            className="object-cover"
            priority
          />
        </Link>
      </div>
      <div className="space-y-2">
        <h3 className="font-heading text-2xl text-foreground">
          {data.breed.name_zh}
          <span className="ml-2 text-base text-muted-foreground">
            {data.breed.name_en}
          </span>
        </h3>
        <p className="max-w-md text-muted-foreground">
          &ldquo;{data.breed.quote}&rdquo;
        </p>
      </div>
      <div className="flex gap-3">
        <Button onClick={handleReroll} disabled={isLoading} size="lg">
          {isLoading ? "召唤中…" : "换一只"}
        </Button>
        <Link
          href={`/cats/${data.breed.id}`}
          className={cn(buttonVariants({ variant: "secondary", size: "lg" }))}
        >
          查看详情
        </Link>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
