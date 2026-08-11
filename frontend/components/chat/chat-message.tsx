"use client";

import { cn } from "@/lib/utils";
import type { ChatMessage as ChatMessageData } from "@/lib/api";

interface ChatMessageProps {
  message: ChatMessageData;
  isStreaming: boolean;
}

export function ChatMessage({ message, isStreaming }: ChatMessageProps) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-xl px-4 py-3",
          isUser
            ? "bg-primary text-primary-foreground"
            : "border border-border bg-card text-foreground",
        )}
      >
        <p className="whitespace-pre-wrap">
          {message.content}
          {isStreaming ? (
            <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-current align-middle" />
          ) : null}
        </p>
        {message.disclaimer ? (
          <p className="mt-2 border-t border-border/60 pt-2 text-xs text-muted-foreground">
            ⚠️ {message.disclaimer}
          </p>
        ) : null}
      </div>
    </div>
  );
}
