"use client";

import { useState } from "react";
import { Copy, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { CopyStyle } from "@/lib/api";

const STYLE_META: Record<CopyStyle, { label: string; emoji: string }> = {
  funny: { label: "搞笑版", emoji: "😂" },
  healing: { label: "治愈版", emoji: "🫂" },
  cool: { label: "高冷版", emoji: "🎭" },
};

interface CopyCardProps {
  style: CopyStyle;
  text: string;
  isGenerating: boolean;
  isRegenerating: boolean;
  onRegenerate: () => void;
  hasGenerated: boolean;
}

export function CopyCard({
  style,
  text,
  isGenerating,
  isRegenerating,
  onRegenerate,
  hasGenerated,
}: CopyCardProps) {
  const meta = STYLE_META[style];
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("failed");
      setTimeout(() => setCopyState("idle"), 2000);
    }
  }

  const busy = isGenerating || isRegenerating;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="font-heading text-xl">
          {meta.emoji} {meta.label}
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRegenerate}
          disabled={busy || !hasGenerated}
        >
          <RefreshCw className={cn("mr-1 h-4 w-4", isRegenerating && "animate-spin")} />
          重新生成
        </Button>
      </CardHeader>
      <CardContent className="flex-1 whitespace-pre-wrap">
        {text ? (
          <p className="text-foreground">
            {text}
            {busy ? <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-primary align-middle" /> : null}
          </p>
        ) : (
          <p className="text-muted-foreground">
            {hasGenerated ? "" : "等待生成…"}
          </p>
        )}
      </CardContent>
      <CardFooter>
        <Button
          variant="secondary"
          className="w-full"
          onClick={handleCopy}
          disabled={!text}
        >
          <Copy className="mr-1 h-4 w-4" />
          {copyState === "copied" ? "已复制 ✓" : copyState === "failed" ? "复制失败" : "一键复制"}
        </Button>
      </CardFooter>
    </Card>
  );
}
