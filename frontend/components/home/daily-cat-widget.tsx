"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { getRandomCat } from "@/lib/api";
import type { DailyCatResponse } from "@/lib/types/cat";

interface DailyCatWidgetProps {
  initialData: DailyCatResponse;
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
        <Image
          src={data.breed.image_url}
          alt={data.breed.name_zh}
          fill
          className="object-cover"
          priority
        />
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
      <Button onClick={handleReroll} disabled={isLoading} size="lg">
        {isLoading ? "召唤中…" : "换一只"}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
