"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatMessage } from "@/components/chat/chat-message";
import { sendChatMessage, type ChatMessage as ChatMessageData } from "@/lib/api";
import type { SSEEvent } from "@/lib/sse";

const SAMPLE_QUESTIONS = [
  { label: "护理", text: "猫砂盆多久清理一次？" },
  { label: "营养", text: "换粮怎么过渡？" },
  { label: "疾病", text: "猫瘟早期有什么症状？" },
];

export function ChatWorkspace() {
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const errorSeenRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  // auto-scroll to the latest message
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function handleSSE(evt: SSEEvent) {
    if (evt.event === "chunk") {
      const { content } = evt.data as { content: string };
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === "assistant") {
          next[next.length - 1] = { ...last, content: last.content + content };
        }
        return next;
      });
    } else if (evt.event === "disclaimer") {
      const { text } = evt.data as { text: string };
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === "assistant") {
          next[next.length - 1] = { ...last, disclaimer: text };
        }
        return next;
      });
    } else if (evt.event === "error") {
      errorSeenRef.current = true;
      setError("回答失败，请稍后重试");
    }
  }

  function markLastAssistantFailed() {
    setMessages((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last && last.role === "assistant" && !last.content) {
        next[next.length - 1] = { ...last, content: "回答失败了，请稍后再试。" };
      }
      return next;
    });
  }

  async function handleSend(message: string) {
    abortRef.current?.abort(); // stop any in-flight stream
    errorSeenRef.current = false;
    setError(null);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: message },
      { role: "assistant", content: "" },
    ]);
    setIsStreaming(true);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      await sendChatMessage(message, handleSSE, ac.signal);
      if (errorSeenRef.current) {
        markLastAssistantFailed();
      }
    } catch {
      if (!ac.signal.aborted) {
        setError("连接失败，请检查后端服务后重试");
        markLastAssistantFailed();
      }
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-4rem)] w-full max-w-3xl flex-col px-6 py-6">
      <Link
        href="/"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← 返回首页
      </Link>
      <div className="mt-2 text-center">
        <h1 className="font-heading text-3xl text-foreground">🐱 疗愈问答助手</h1>
        <p className="mt-1 text-muted-foreground">猫咪护理、营养、健康问题，随时来问</p>
      </div>

      <div ref={listRef} className="mt-6 flex-1 space-y-4 overflow-y-auto pb-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <p className="text-muted-foreground">有什么想知道的？试试这些问题：</p>
            <div className="flex flex-col gap-2">
              {SAMPLE_QUESTIONS.map((q) => (
                <button
                  key={q.text}
                  type="button"
                  onClick={() => handleSend(q.text)}
                  disabled={isStreaming}
                  className="rounded-full border border-border px-4 py-2 text-sm text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
                >
                  {q.label} · {q.text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <ChatMessage
              key={i}
              message={m}
              isStreaming={isStreaming && i === messages.length - 1 && m.role === "assistant"}
            />
          ))
        )}
      </div>

      {error ? (
        <p className="mb-2 rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <ChatInput disabled={isStreaming} onSend={handleSend} />
    </div>
  );
}
