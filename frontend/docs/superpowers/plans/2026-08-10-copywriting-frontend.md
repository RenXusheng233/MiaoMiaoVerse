# 文案生成前端实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 前端实现 PRD 3.3 文案生成页面:表单 + 三版并行 SSE 流式渲染 + 单版重新生成 + 一键复制。

**Architecture:** 页面壳为服务端组件(获取品种列表),工作区为客户端组件编排状态机;`fetch` + `ReadableStream` 手写 SSE 解析(EventSource 不支持 POST);chunk 按 style 分发到三张卡片各自流式渲染。

**Tech Stack:** Next.js 16.2 · TypeScript 5 · Tailwind v4 · shadcn/ui(input/select/textarea/label/combobox)· motion · Playwright

**Spec:** `frontend/docs/superpowers/specs/2026-08-10-copywriting-frontend-design.md`

## Global Constraints

- 全部代码在 `frontend/` 下;命令从 `frontend/` 运行;依赖管理用 **bun**
- Next.js 16 有破坏性变更:改代码前查 `node_modules/next/dist/docs/`
- 类合并用 `cn()`;设计令牌来自 globals.css;注释英文、用户文案中文
- 项目暂无测试框架:静态验证 `bunx tsc --noEmit` + `bun lint` + `bun run build`;端到端 Playwright
- 项目初期:实现者**不执行** `git add` / `git commit`(用户手动提交)
- 后端协议(已定,勿改):`POST /api/copy/generate`、`POST /api/copy/regenerate`;SSE 事件 `chunk {style, content}` / `done {style}` / `error {message}`;style ∈ funny/healing/cool;platform ∈ moments/weibo/xiaohongshu/douyin
- `getCats()` 已在 lib/api.ts(no-store);品种列表在页面 RSC 获取后作为 prop 传入工作区(客户端不再重复 fetch)
- 验证时后端需运行:`uvicorn main:app --port 8000`(backend 目录)

---

### Task 1: shadcn 组件安装 + SSE 解析器 + API 扩展

**Files:**
- Create: `frontend/lib/sse.ts`
- Modify: `frontend/lib/api.ts`(类型 + generateCopyStream / regenerateCopyStream)
- shadcn 生成:`components/ui/input.tsx`、`select.tsx`、`textarea.tsx`、`label.tsx`、`combobox.tsx`

**Interfaces:**
- Produces: `SSEEvent` / `streamSSE(url, options, onEvent, signal?)` / `parseSSEFrame(frame)`、`Platform` / `CopyStyle` / `CopyForm` / `generateCopyStream` / `regenerateCopyStream` — 供 Task 2-4 使用

- [ ] **Step 1: 安装 shadcn 组件**

Run: `cd /Users/renxusheng/Documents/AI/MiaoMiaoVerse/frontend && bunx shadcn add input select textarea label combobox`
Expected: 五个组件生成到 `components/ui/`;`bun run build` 通过(确认无破坏)

- [ ] **Step 2: 创建 SSE 解析器**

```ts
// frontend/lib/sse.ts
/** Minimal fetch-based SSE parser. EventSource cannot POST, so we read the
 * response body as a stream and split frames on blank lines. Reusable by
 * the chat page (3.5). */

export interface SSEEvent {
  event: string; // "chunk" | "done" | "error" | ...
  data: unknown; // JSON.parse result, or raw text when parsing fails
}

export function parseSSEFrame(frame: string): SSEEvent | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }
  if (dataLines.length === 0) {
    return null;
  }
  const raw = dataLines.join("\n");
  try {
    return { event, data: JSON.parse(raw) };
  } catch {
    return { event, data: raw };
  }
}

export async function streamSSE(
  url: string,
  options: RequestInit,
  onEvent: (evt: SSEEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(url, { ...options, signal });
  if (!res.ok) {
    throw new Error(`SSE request failed: ${res.status}`);
  }
  if (!res.body) {
    throw new Error("SSE response has no body");
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const evt = parseSSEFrame(frame);
      if (evt) {
        onEvent(evt);
      }
    }
  }
}
```

- [ ] **Step 3: 扩展 `lib/api.ts`**

在文件末尾追加(保持现有 API_BASE_URL 与类型 import 不变,`CatBreed` 已在类型 import 中):

```ts
import { streamSSE, type SSEEvent } from "@/lib/sse";

export type Platform = "moments" | "weibo" | "xiaohongshu" | "douyin";
export type CopyStyle = "funny" | "healing" | "cool";

export interface CopyForm {
  cat_name: string;
  breed?: string;
  behavior?: string;
  style_pref?: string;
  platform: Platform;
}

export function generateCopyStream(
  form: CopyForm,
  onEvent: (evt: SSEEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  return streamSSE(
    `${API_BASE_URL}/api/copy/generate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    },
    onEvent,
    signal,
  );
}

export function regenerateCopyStream(
  form: CopyForm & { style: CopyStyle },
  onEvent: (evt: SSEEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  return streamSSE(
    `${API_BASE_URL}/api/copy/regenerate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    },
    onEvent,
    signal,
  );
}
```

> 注:import 语句放在文件顶部(与现有 import 合并),不要在文件中间写 import。

- [ ] **Step 4: 验证 SSE 解析(bun 直跑 TS 脚本,mock fetch)**

写临时脚本 `/tmp/sse-test.ts`:

```ts
import { parseSSEFrame, streamSSE, type SSEEvent } from "/Users/renxusheng/Documents/AI/MiaoMiaoVerse/frontend/lib/sse";

// parseSSEFrame 纯函数
const frame = "event: chunk\ndata: {\"style\":\"funny\",\"content\":\"你好\"}\n";
const parsed = parseSSEFrame(frame);
if (parsed?.event !== "chunk" || (parsed.data as any).style !== "funny") {
  throw new Error("parseSSEFrame failed");
}
console.log("parseSSEFrame OK:", JSON.stringify(parsed));

// streamSSE:mock fetch 返回分段流
const chunks = [
  'event: chunk\ndata: {"style":"funny","content":"第',
  '一段"}\n\nevent: chunk\ndata: {"style":"cool","content":"第二段"}\n\nevent: done\ndata: {"style":"funny"}\n\n',
];
globalThis.fetch = async () =>
  new Response(
    new ReadableStream({
      start(controller) {
        for (const c of chunks) controller.enqueue(new TextEncoder().encode(c));
        controller.close();
      },
    }),
    { status: 200 },
  ) as Response;

const received: SSEEvent[] = [];
await streamSSE("http://fake/api/copy/generate", { method: "POST" }, (e) => received.push(e));
if (received.length !== 3) throw new Error(`expected 3 events, got ${received.length}`);
if (received[1].event !== "chunk" || (received[1].data as any).content !== "第二段") {
  throw new Error("cross-frame content wrong");
}
console.log("streamSSE OK:", received.map((e) => e.event).join(","));
```

Run: `bun /tmp/sse-test.ts`
Expected: 输出 `parseSSEFrame OK: {"event":"chunk","data":{"style":"funny","content":"你好"}}` 和 `streamSSE OK: chunk,chunk,done`

- [ ] **Step 5: 类型 + lint + 构建**

Run: `bunx tsc --noEmit && bun lint && bun run build`
Expected: 零错误

- [ ] **Step 6: 结束任务验证**

```bash
git status --short
```
Expected: 新增 lib/sse.ts、components/ui/{input,select,textarea,label,combobox}.tsx,修改 lib/api.ts(不提交)

---

### Task 2: 表单组件(combobox + chips + select)

**Files:**
- Create: `frontend/components/copywriting/copy-form.tsx`

**Interfaces:**
- Consumes: Task 1 的 `CopyForm` / `Platform`;`CatBreed`(prop);`components/ui/*`(shadcn 生成)
- Produces: `CopyForm({ value, onChange, cats, disabled, onSubmit })`("use client")— 供 Task 4 使用

- [ ] **Step 1: 查看生成的 combobox 组件 API**

Run: `sed -n '1,80p' components/ui/combobox.tsx`
先阅读 shadcn 生成的 combobox 组件(props 形态、是受控还是内部状态、依赖哪些子组件如 command/popover),再按它的实际 API 编写表单。若 combobox 生成失败或依赖缺失,用 `bunx shadcn add command popover` 补齐后重试。

- [ ] **Step 2: 创建表单组件**

按以下结构实现(combobox 部分按其实际 API 适配):

```tsx
// frontend/components/copywriting/copy-form.tsx
"use client";

import { ChevronsUpDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { CopyForm, Platform } from "@/lib/api";
import type { CatBreed } from "@/lib/types/cat";

const BEHAVIOR_CHIPS = ["正在拆沙发", "刚睡醒", "粘人精附体", "疯狂跑酷", "求摸摸", "犯错了装无辜"];

const STYLE_CHIPS = ["带点反差萌", "语气沙雕一点", "治愈温柔一点", "高冷傲娇", "撒个娇"];

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: "moments", label: "朋友圈" },
  { value: "weibo", label: "微博" },
  { value: "xiaohongshu", label: "小红书" },
  { value: "douyin", label: "抖音" },
];

interface CopyFormProps {
  value: CopyForm;
  onChange: (form: CopyForm) => void;
  cats: CatBreed[];
  disabled: boolean;
  onSubmit: () => void;
}

export function CopyForm({ value, onChange, cats, disabled, onSubmit }: CopyFormProps) {
  const set = <K extends keyof CopyForm>(key: K, val: CopyForm[K]) =>
    onChange({ ...value, [key]: val });

  return (
    <div className="space-y-4">
      {/* 猫咪名字(必填) */}
      <div className="grid gap-1.5">
        <Label htmlFor="cat-name">猫咪名字 *</Label>
        <Input
          id="cat-name"
          value={value.cat_name}
          onChange={(e) => set("cat_name", e.target.value)}
          placeholder="例如:布丁"
          maxLength={50}
          disabled={disabled}
        />
      </div>

      {/* 品种(combobox,可搜索,可不选) */}
      <div className="grid gap-1.5">
        <Label>品种</Label>
        {/* 按 combobox 实际 API 适配:选项 = cats 映射 {value: name_zh, label: name_zh(+name_en)} + 一个"不填"空选项 */}
        <Combobox
          options={[
            { value: "", label: "不填(未知品种)" },
            ...cats.map((c) => ({ value: c.name_zh, label: `${c.name_zh} ${c.name_en}` })),
          ]}
          value={value.breed ?? ""}
          onChange={(v: string) => set("breed", v || undefined)}
          placeholder="搜索品种…"
          disabled={disabled}
        />
      </div>

      {/* 当前状态/行为 + chips */}
      <div className="grid gap-1.5">
        <Label htmlFor="behavior">当前状态/行为</Label>
        <Input
          id="behavior"
          value={value.behavior ?? ""}
          onChange={(e) => set("behavior", e.target.value || undefined)}
          maxLength={100}
          disabled={disabled}
        />
        <div className="flex flex-wrap gap-2">
          {BEHAVIOR_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => set("behavior", chip)}
              className="rounded-full border border-border px-3 py-1 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              disabled={disabled}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* 风格偏好 + chips */}
      <div className="grid gap-1.5">
        <Label htmlFor="style-pref">风格偏好</Label>
        <Input
          id="style-pref"
          value={value.style_pref ?? ""}
          onChange={(e) => set("style_pref", e.target.value || undefined)}
          maxLength={200}
          disabled={disabled}
        />
        <div className="flex flex-wrap gap-2">
          {STYLE_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => set("style_pref", chip)}
              className="rounded-full border border-border px-3 py-1 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              disabled={disabled}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* 平台目标 */}
      <div className="grid gap-1.5">
        <Label>平台目标</Label>
        <Select value={value.platform} onValueChange={(v) => set("platform", v as Platform)} disabled={disabled}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PLATFORMS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button onClick={onSubmit} disabled={disabled || !value.cat_name.trim()} size="lg" className="w-full">
        生成文案
      </Button>
      {!value.cat_name.trim() ? (
        <p className="text-sm text-muted-foreground">给猫咪起个名字吧</p>
      ) : null}
    </div>
  );
}
```

> 注:chips 用原生 `<button type="button">`(轻量交互元素,无需 Button 组件变体);combobox 的空选项值用 `""` 表示"不填",提交时转 `undefined`。

- [ ] **Step 3: 类型 + lint**

Run: `bunx tsc --noEmit && bun lint`
Expected: 零错误(若 combobox API 与上面示例不符,按生成的组件实际 API 调整并记录差异)

- [ ] **Step 4: 结束任务验证**

```bash
git status --short
```
Expected: 新增 components/copywriting/copy-form.tsx(不提交)

---

### Task 3: 三版卡片(流式渲染 + 重新生成 + 复制)

**Files:**
- Create: `frontend/components/copywriting/copy-card.tsx`

**Interfaces:**
- Consumes: Task 1 的 `CopyStyle` 类型
- Produces: `CopyCard({ style, text, isGenerating, isRegenerating, onRegenerate, hasGenerated })`("use client")— 供 Task 4 使用

- [ ] **Step 1: 创建卡片组件**

```tsx
// frontend/components/copywriting/copy-card.tsx
"use client";

import { useState } from "react";
import { Copy, RefreshCw } from "lucide-react";
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
```

> 注:`cn` 需 import;光标动画用 `animate-pulse` 的小竖条。

- [ ] **Step 2: 类型 + lint**

Run: `bunx tsc --noEmit && bun lint`
Expected: 零错误

- [ ] **Step 3: 结束任务验证**

```bash
git status --short
```
Expected: 新增 components/copywriting/copy-card.tsx(不提交)

---

### Task 4: 工作区编排 + 页面

**Files:**
- Create: `frontend/components/copywriting/copy-workspace.tsx`
- Create: `frontend/app/copywriting/page.tsx`
- Create: `frontend/app/copywriting/loading.tsx`

**Interfaces:**
- Consumes: Task 1 的 `generateCopyStream` / `regenerateCopyStream` / `SSEEvent` / `CopyForm` / `CopyStyle`;Task 2 的 `CopyForm` 组件;Task 3 的 `CopyCard`;`getCats()`
- Produces: `/copywriting` 页面(三版并行流式生成 + 单版重生成 + 复制)

- [ ] **Step 1: 创建工作区组件**

```tsx
// frontend/components/copywriting/copy-workspace.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { CopyCard } from "@/components/copywriting/copy-card";
import { CopyForm } from "@/components/copywriting/copy-form";
import {
  generateCopyStream,
  regenerateCopyStream,
  type CopyForm as CopyFormData,
  type CopyStyle,
} from "@/lib/api";
import type { CatBreed } from "@/lib/types/cat";
import type { SSEEvent } from "@/lib/sse";

const STYLES: CopyStyle[] = ["funny", "healing", "cool"];

interface CopyWorkspaceProps {
  cats: CatBreed[];
}

export function CopyWorkspace({ cats }: CopyWorkspaceProps) {
  const [form, setForm] = useState<CopyFormData>({ cat_name: "", platform: "moments" });
  const lastFormRef = useRef<CopyFormData | null>(null);
  const [results, setResults] = useState<Record<CopyStyle, string>>({
    funny: "",
    healing: "",
    cool: "",
  });
  const [status, setStatus] = useState<"idle" | "generating" | "complete" | "error">("idle");
  const [regenerating, setRegenerating] = useState<CopyStyle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  function handleSSE(evt: SSEEvent) {
    if (evt.event === "chunk") {
      const { style, content } = evt.data as { style: CopyStyle; content: string };
      setResults((prev) => ({ ...prev, [style]: prev[style] + content }));
    } else if (evt.event === "error") {
      setError("文案生成失败,请稍后重试");
      setStatus("error");
    }
  }

  async function handleGenerate() {
    if (!form.cat_name.trim()) {
      return;
    }
    abortRef.current?.abort(); // stop any in-flight regenerate
    lastFormRef.current = { ...form };
    setResults({ funny: "", healing: "", cool: "" });
    setError(null);
    setStatus("generating");
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      await generateCopyStream(form, handleSSE, ac.signal);
      setStatus("complete");
    } catch {
      if (!ac.signal.aborted) {
        setError("生成失败,请检查后端服务后重试");
        setStatus("error");
      }
    }
  }

  async function handleRegenerate(style: CopyStyle) {
    if (!lastFormRef.current) {
      return;
    }
    abortRef.current?.abort(); // stop any in-flight generate
    setRegenerating(style);
    setResults((prev) => ({ ...prev, [style]: "" }));
    setError(null);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      await regenerateCopyStream({ ...lastFormRef.current, style }, handleSSE, ac.signal);
    } catch {
      if (!ac.signal.aborted) {
        setError("重新生成失败,请稍后重试");
      }
    } finally {
      setRegenerating(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <header className="mb-8 text-center">
        <h1 className="font-heading text-3xl text-foreground">朋友圈文案神器</h1>
        <p className="mt-2 text-muted-foreground">
          填上猫咪的信息,一键生成三个风格的文案
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,360px)_1fr]">
        <div>
          <CopyForm
            value={form}
            onChange={setForm}
            cats={cats}
            disabled={status === "generating" || regenerating !== null}
            onSubmit={handleGenerate}
          />
          {error ? (
            <p className="mt-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {STYLES.map((style) => (
            <CopyCard
              key={style}
              style={style}
              text={results[style]}
              isGenerating={status === "generating"}
              isRegenerating={regenerating === style}
              onRegenerate={() => handleRegenerate(style)}
              hasGenerated={status === "complete" || status === "error" || results[style].length > 0}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建页面 + loading**

```tsx
// frontend/app/copywriting/page.tsx
import { CopyWorkspace } from "@/components/copywriting/copy-workspace";
import { getCats } from "@/lib/api";

export default async function CopywritingPage() {
  const cats = await getCats();
  return <CopyWorkspace cats={cats} />;
}
```

```tsx
// frontend/app/copywriting/loading.tsx
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="h-9 w-52 animate-pulse rounded-lg bg-muted" />
        <div className="h-5 w-72 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,360px)_1fr]">
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 类型 + lint + 构建**

Run: `bunx tsc --noEmit && bun lint && bun run build`
Expected: 零错误;路由表含 `/copywriting`(ƒ 动态,因 getCats no-store)

- [ ] **Step 4: 结束任务验证**

```bash
git status --short
```
Expected: 新增 copy-workspace.tsx、app/copywriting/(page + loading)(不提交)

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
cd /Users/renxusheng/Documents/AI/MiaoMiaoVerse/backend && source .venv/bin/activate && uvicorn main:app --port 8000 > /tmp/e2e_copy_backend.log 2>&1 &
# 前端
cd /Users/renxusheng/Documents/AI/MiaoMiaoVerse/frontend && bun dev > /tmp/e2e_copy_frontend.log 2>&1 &
sleep 8
curl -s -o /dev/null -w "backend: %{http_code}\n" http://localhost:8000/api/copy/generate -X POST -H "Content-Type: application/json" -d '{"cat_name":"布丁"}'
curl -s -o /dev/null -w "frontend: %{http_code}\n" http://localhost:3000/copywriting
```
Expected: 两个 200

- [ ] **Step 2: Playwright 生成流验证**

用浏览器工具:
1. `browser_navigate` → `http://localhost:3000/copywriting`
2. `browser_snapshot` → 确认:标题"朋友圈文案神器"、表单(名字/品种/行为/风格/平台)、三张卡片("😂 搞笑版"、"🫂 治愈版"、"🎭 高冷版")、生成按钮禁用状态(名字为空)
3. 填入猫咪名字(如"布丁")→ 生成按钮变为可用
4. 点一个行为 chip("正在拆沙发")→ 行为输入框值变化
5. 点生成 → 三卡开始流式渲染;等待流结束(后端三版并行,约 20-60 秒,`browser_wait_for` 轮询文本出现)
6. `browser_snapshot` → 三卡文本非空;`browser_evaluate` 提取三卡文本长度均 > 0
7. combobox:打开品种下拉 → 输入"布" → 出现"布偶猫"选项;选一个品种
8. 点某卡"重新生成" → 仅该卡清空后重新流式(`browser_evaluate` 对比前后)
9. 点"一键复制" → 按钮变"已复制 ✓"
10. `browser_console_messages(level: "error")` → 无错误(复制权限失败除外,若有则记录)
11. 响应式:`browser_resize(390×844)` → 表单与三卡单列(`browser_evaluate` 检查 gridTemplateColumns)

- [ ] **Step 3: 错误路径验证**

Run:
```bash
# 停后端 → 点生成 → 应显示全局错误条
kill %1 2>/dev/null
```
用 `browser_navigate` 回页面 → 点生成 → `browser_snapshot` 确认错误提示"生成失败,请检查后端服务后重试";重启后端 → 再次生成恢复正常

- [ ] **Step 4: 收尾检查**

Run:
```bash
grep -icE "error|exception" /tmp/e2e_copy_backend.log /tmp/e2e_copy_frontend.log || echo "logs clean"
pkill -f "uvicorn main:app" 2>/dev/null; pkill -f "next dev" 2>/dev/null
git status --short
```
Expected: 前后端日志无 error;进程清理;新增 sse.ts、copy-form/copy-card/copy-workspace、app/copywriting/、components/ui/{input,select,textarea,label,combobox}.tsx,修改 lib/api.ts,均未提交
