# 疗愈问答前端实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 前端实现 PRD 3.5 疗愈问答页面:聊天式消息列表 + SSE 流式回答 + 医疗免责声明跟随展示。

**Architecture:** 复用 `lib/sse.ts` 的 `streamSSE`(零改动,协议同款);页面壳为服务端组件(chat 无需 RSC 数据),工作区为客户端组件编排消息列表与 SSE 流;竞态防护沿用 copy-workspace 的既有模式(abort-before-new + errorSeen 守卫)。

**Tech Stack:** Next.js 16.2 · TypeScript 5 · Tailwind v4 · shadcn/ui(textarea)· lucide-react · Playwright

**Spec:** `frontend/docs/superpowers/specs/2026-08-10-chat-frontend-design.md`

## Global Constraints

- 全部代码在 `frontend/` 下;命令从 `frontend/` 运行;依赖管理用 **bun**
- Next.js 16 有破坏性变更:改代码前查 `node_modules/next/dist/docs/`
- 类合并用 `cn()`;设计令牌来自 globals.css;注释英文、用户文案中文
- 项目暂无测试框架:静态验证 `bunx tsc --noEmit` + `bun lint` + `bun run build`;端到端 Playwright
- 项目初期:实现者**不执行** `git add` / `git commit`(用户手动提交)
- 后端协议(已定,勿改):`POST /api/chat`,body `{ message }`;SSE 事件 `chunk {content}` / `done {}` / `error {message}` / `disclaimer {text}`(仅医疗路由)
- `lib/sse.ts` 的 `streamSSE` 已有且协议兼容——**不修改它**
- 多轮记忆是非目标:后端单轮无状态,前端消息列表仅 UI 展示,历史不发给后端
- 验证时后端需运行:`uvicorn main:app --port 8000`(backend 目录)

---

### Task 1: API 扩展 + 页面壳

**Files:**
- Modify: `frontend/lib/api.ts`(ChatMessage + sendChatMessage)
- Create: `frontend/app/chat/page.tsx`、`frontend/app/chat/loading.tsx`

**Interfaces:**
- Produces: `ChatMessage`(role/content/disclaimer?)、`sendChatMessage(message, onEvent, signal)` — 供 Task 4 使用

- [ ] **Step 1: 扩展 `lib/api.ts`**

`lib/api.ts` 已有 `import { streamSSE, type SSEEvent } from "@/lib/sse"`(3.3 加的),在文件末尾追加:

```ts
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  disclaimer?: string; // medical-route disclaimer text (compliance)
}

export function sendChatMessage(
  message: string,
  onEvent: (evt: SSEEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  return streamSSE(
    `${API_BASE_URL}/api/chat`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    },
    onEvent,
    signal,
  );
}
```

- [ ] **Step 2: 创建页面壳**

```tsx
// frontend/app/chat/page.tsx
import { ChatWorkspace } from "@/components/chat/chat-workspace";

export default function ChatPage() {
  return <ChatWorkspace />;
}
```

```tsx
// frontend/app/chat/loading.tsx
export default function Loading() {
  return (
    <div className="mx-auto flex h-[calc(100dvh-4rem)] w-full max-w-3xl flex-col px-6 py-6">
      <div className="h-4 w-20 animate-pulse rounded bg-muted" />
      <div className="mt-4 flex flex-col items-center gap-2">
        <div className="h-9 w-52 animate-pulse rounded-lg bg-muted" />
        <div className="h-5 w-72 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="mt-6 flex-1 space-y-4">
        <div className="flex justify-end">
          <div className="h-16 w-64 animate-pulse rounded-3xl bg-muted" />
        </div>
        <div className="flex justify-start">
          <div className="h-20 w-80 animate-pulse rounded-3xl bg-muted" />
        </div>
      </div>
      <div className="h-11 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
```

> 注:`ChatWorkspace` 在 Task 4 创建——本任务 Step 3 验证时 page.tsx 会因缺失组件编译失败;因此 Task 1 只完成 api.ts + loading.tsx,page.tsx 的创建放到 Task 4 一并完成(与 3.2 模块同样的拆分策略)。

- [ ] **Step 3: 类型 + lint**

Run: `bunx tsc --noEmit && bun lint`
Expected: 零错误(仅 api.ts 扩展与 loading.tsx)

- [ ] **Step 4: 结束任务验证**

```bash
git status --short
```
Expected: 修改 lib/api.ts,新增 app/chat/loading.tsx(不提交)

---

### Task 2: 聊天消息组件

**Files:**
- Create: `frontend/components/chat/chat-message.tsx`

**Interfaces:**
- Consumes: Task 1 的 `ChatMessage` 类型
- Produces: `ChatMessage({ message, isStreaming })`("use client")— 供 Task 4 使用

- [ ] **Step 1: 创建消息组件**

```tsx
// frontend/components/chat/chat-message.tsx
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
          "max-w-[80%] rounded-3xl px-4 py-3",
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
```

- [ ] **Step 2: 类型 + lint**

Run: `bunx tsc --noEmit && bun lint`
Expected: 零错误

- [ ] **Step 3: 结束任务验证**

```bash
git status --short
```
Expected: 新增 components/chat/chat-message.tsx(不提交)

---

### Task 3: 输入区

**Files:**
- Create: `frontend/components/chat/chat-input.tsx`

**Interfaces:**
- Consumes: shadcn `Textarea`(`components/ui/textarea.tsx`)、`Button`
- Produces: `ChatInput({ disabled, onSend })`("use client")— 供 Task 4 使用

- [ ] **Step 1: 创建输入组件**

```tsx
// frontend/components/chat/chat-input.tsx
"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ChatInputProps {
  disabled: boolean;
  onSend: (message: string) => void;
}

export function ChatInput({ disabled, onSend }: ChatInputProps) {
  const [value, setValue] = useState("");

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || disabled) {
      return;
    }
    onSend(trimmed);
    setValue("");
  }

  return (
    <div className="flex items-end gap-2">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          // skip IME composition confirms (Chinese input method Enter)
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            handleSend();
          }
        }}
        placeholder="问问猫咪的事…"
        className="min-h-11 max-h-32 flex-1 resize-none"
        disabled={disabled}
      />
      <Button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        size="icon"
        aria-label="发送"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

> 注:shadcn 生成的 `Textarea` 具体 props(如 `rows`/`min-h` 类合并方式)按实际组件 API 适配;Enter 发送、Shift+Enter 换行;发送后清空。

- [ ] **Step 2: 类型 + lint**

Run: `bunx tsc --noEmit && bun lint`
Expected: 零错误

- [ ] **Step 3: 结束任务验证**

```bash
git status --short
```
Expected: 新增 components/chat/chat-input.tsx(不提交)

---

### Task 4: 工作区编排 + 页面

**Files:**
- Create: `frontend/components/chat/chat-workspace.tsx`
- Create: `frontend/app/chat/page.tsx`(Task 1 推迟的)

**Interfaces:**
- Consumes: Task 1 的 `sendChatMessage` / `ChatMessage`;Task 2 的 `ChatMessage` 组件;Task 3 的 `ChatInput`;`streamSSE` 事件
- Produces: `/chat` 页面(聊天式流式问答 + 免责声明 + 示例问题)

- [ ] **Step 1: 创建工作区组件**

```tsx
// frontend/components/chat/chat-workspace.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatMessage } from "@/components/chat/chat-message";
import { sendChatMessage, type ChatMessage as ChatMessageData } from "@/lib/api";
import type { SSEEvent } from "@/lib/sse";

const SAMPLE_QUESTIONS = [
  { label: "护理", text: "猫砂盆多久清理一次?" },
  { label: "营养", text: "换粮怎么过渡?" },
  { label: "疾病", text: "猫瘟早期有什么症状?" },
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
      setError("回答失败,请稍后重试");
    }
  }

  function markLastAssistantFailed() {
    setMessages((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last && last.role === "assistant" && !last.content) {
        next[next.length - 1] = { ...last, content: "回答失败了,请稍后再试。" };
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
        setError("连接失败,请检查后端服务后重试");
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
        <p className="mt-1 text-muted-foreground">猫咪护理、营养、健康问题,随时来问</p>
      </div>

      <div ref={listRef} className="mt-6 flex-1 space-y-4 overflow-y-auto pb-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <p className="text-muted-foreground">有什么想知道的?试试这些问题:</p>
            <div className="flex flex-col gap-2">
              {SAMPLE_QUESTIONS.map((q) => (
                <button
                  key={q.text}
                  type="button"
                  onClick={() => handleSend(q.text)}
                  disabled={isStreaming}
                  className="rounded-full border border-border px-4 py-2 text-sm text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
                >
                  {q.label}·{q.text}
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
```

- [ ] **Step 2: 创建页面壳**

```tsx
// frontend/app/chat/page.tsx
import { ChatWorkspace } from "@/components/chat/chat-workspace";

export default function ChatPage() {
  return <ChatWorkspace />;
}
```

- [ ] **Step 3: 类型 + lint + 构建**

Run: `bunx tsc --noEmit && bun lint && bun run build`
Expected: 零错误;路由表含 `/chat`

- [ ] **Step 4: 结束任务验证**

```bash
git status --short
```
Expected: 新增 chat-workspace.tsx、app/chat/(page + loading)(不提交)

---

### Task 5: 端到端验证(Playwright)

**Files:**
- 无新文件,验证既有行为

**Interfaces:**
- Consumes: Task 1-4 的全部功能;后端 `uvicorn main:app --port 8000`

- [ ] **Step 1: 启动前后端**

Run:
```bash
# 后端(backend 目录)
cd /Users/renxusheng/Documents/AI/MiaoMiaoVerse/backend && source .venv/bin/activate && uvicorn main:app --port 8000 > /tmp/e2e_chat_backend.log 2>&1 &
# 前端
cd /Users/renxusheng/Documents/AI/MiaoMiaoVerse/frontend && bun dev > /tmp/e2e_chat_frontend.log 2>&1 &
sleep 8
curl -s -o /dev/null -w "backend: %{http_code}\n" http://localhost:8000/api/chat -X POST -H "Content-Type: application/json" -d '{"message":"hi"}'
curl -s -o /dev/null -w "frontend: %{http_code}\n" http://localhost:3000/chat
```
Expected: 两个 200

- [ ] **Step 2: Playwright 聊天流验证**

用浏览器工具:
1. `browser_navigate` → `http://localhost:3000/chat`
2. `browser_snapshot` → 确认:返回首页链接、标题"🐱 疗愈问答助手"、空状态示例问题 3 张卡片、输入区(textarea + 发送按钮)
3. 点示例问题卡片(如"疾病·猫瘟早期有什么症状?")→ 消息列表出现用户气泡 + AI 气泡流式渲染
4. `browser_wait_for` AI 回答完成(真实 LLM,约 10-30 秒)→ `browser_snapshot`:AI 气泡非空且**下方有免责声明**(⚠️ 以上内容由 AI 生成…)
5. 输入"今天好累啊" → 发送 → AI 流式回答 → **无免责声明**(闲聊路由)
6. 多轮:连续两问 → 消息累积,第二轮正常流式
7. 流式进行中:输入区/发送按钮禁用(`browser_evaluate` 检查 disabled)
8. `browser_console_messages(level: "error")` → 无错误
9. 响应式:`browser_resize(390×844)` → 气泡宽度自适应、输入区正常

- [ ] **Step 3: 错误路径验证**

Run:
```bash
kill %1 2>/dev/null  # 停后端
```
`browser_navigate` 回页面 → 输入并发送 → 全局错误条 + AI 气泡显示"回答失败了";重启后端 → 再次发送恢复

- [ ] **Step 4: 收尾检查**

Run:
```bash
grep -icE "error|exception" /tmp/e2e_chat_backend.log /tmp/e2e_chat_frontend.log || echo "logs clean"
pkill -f "uvicorn main:app" 2>/dev/null; pkill -f "next dev" 2>/dev/null
git status --short
```
Expected: 日志无 error;进程清理;新增 components/chat/(chat-message/chat-input/chat-workspace)、app/chat/(page/loading),修改 lib/api.ts,均未提交
