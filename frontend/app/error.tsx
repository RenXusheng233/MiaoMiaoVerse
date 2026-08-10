"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h2 className="font-heading text-3xl text-foreground">喵呜...出了点问题</h2>
      <p className="max-w-md text-muted-foreground">
        页面加载失败了，可能是后端服务暂时不可用。请稍后再试。
      </p>
      <Button onClick={() => unstable_retry()} size="lg">
        重试一下
      </Button>
    </div>
  );
}
