# 猫咪百科前端实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 前端实现 PRD 3.2 猫咪百科(首页品种画廊 + 详情页 + 自绘 SVG 雷达图),并与 3.1 今日明星猫联动。

**Architecture:** 延续现有 RSC 模式:首页 `Promise.all` 并行获取今日猫 + 全品种列表;画廊/详情均为服务端组件,仅雷达图为客户端组件(motion 动画);`/cats/[id]` 动态路由,不存在 → `notFound()`。

**Tech Stack:** Next.js 16.2(App Router)· TypeScript 5(strict)· Tailwind CSS v4 · motion · next/image · Playwright(端到端验证)

**Spec:** `frontend/docs/superpowers/specs/2026-08-10-encyclopedia-frontend-design.md`

## Global Constraints

- 全部代码在 `frontend/` 下;命令从 `frontend/` 运行;依赖管理用 **bun**(绝不 npm/yarn)
- Next.js 16 有破坏性变更:改代码前查 `node_modules/next/dist/docs/`(如 `params` 是 Promise、error 用 `unstable_retry`)
- 类合并一律 `cn()`;设计令牌(oklch)来自 `app/globals.css` 的 `@theme`,不硬编码色值
- 项目暂无测试框架:静态验证用 `bunx tsc --noEmit` + `bun lint` + `bun run build`;端到端用 Playwright(浏览器自动化)
- 项目初期:实现者**不执行** `git add` / `git commit`(用户手动提交)
- 代码注释用英文;用户可见文案用中文
- 画廊/详情图片用 `next/image`;`cdn2.thecatapi.com` 已在 remotePatterns
- 数据获取 `cache: "no-store"`(与现有 lib/api.ts 一致)
- 验证时后端需运行:`uvicorn main:app --port 8000`(backend 目录);前端 dev 默认 3000

---

### Task 1: API 层扩展 + 首页并行获取

**Files:**
- Modify: `frontend/lib/api.ts`(新增 getCats / getCat)
- Modify: `frontend/app/page.tsx`(Promise.all 并行)
- Modify: `frontend/app/loading.tsx`(画廊占位)

**Interfaces:**
- Produces: `getCats(): Promise<CatBreed[]>`、`getCat(id: string): Promise<CatBreed | null>`(404 → null)— 供 Task 2/4 使用

- [ ] **Step 1: 扩展 `lib/api.ts`**

在 `getRandomCat` 之后追加:

```ts
export async function getCats(): Promise<CatBreed[]> {
  const res = await fetch(`${API_BASE_URL}/api/cats`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch cats: ${res.status}`);
  }
  return res.json();
}

export async function getCat(id: string): Promise<CatBreed | null> {
  const res = await fetch(`${API_BASE_URL}/api/cats/${id}`, {
    cache: "no-store",
  });
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch cat ${id}: ${res.status}`);
  }
  return res.json();
}
```

> 注:`app/page.tsx` 的 Promise.all + CatGallery 接入在 Task 2 一并完成(避免引用尚未创建的组件导致编译失败)。本任务不触碰 page.tsx。

- [ ] **Step 2: 改造 `app/loading.tsx`**

在 daily cat 占位之前插入画廊占位(3 列网格骨架):

```tsx
      {/* 画廊占位 */}
      <div className="mx-auto w-full max-w-5xl px-6 py-16">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="h-8 w-40 animate-pulse rounded-lg bg-muted" />
          <div className="h-5 w-56 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="aspect-square w-full animate-pulse rounded-3xl bg-muted" />
              <div className="h-5 w-20 animate-pulse rounded-md bg-muted" />
            </div>
          ))}
        </div>
      </div>
```

> **实现顺序注意**:page.tsx 引用 CatGallery 会导致 Task 1 验证失败——本任务验证时,先在 page.tsx 中保留对 CatGallery 的 import 注释占位,实际 Task 2 落地后再取消注释。为让 Task 1 独立可验证,改为:Task 1 只改 api.ts + loading.tsx,page.tsx 的 Promise.all + CatGallery 接入放到 Task 2 一并完成。

- [ ] **Step 3: 类型检查**

Run: `bunx tsc --noEmit && bun lint`
Expected: 零错误(api.ts 新函数类型正确)

- [ ] **Step 4: 结束任务验证**

```bash
git status --short
```
Expected: 修改 lib/api.ts、app/loading.tsx(不提交)

---

### Task 2: 品种画廊 + 今日猫联动

**Files:**
- Create: `frontend/components/home/cat-gallery.tsx`
- Modify: `frontend/app/page.tsx`(接入 CatGallery + Promise.all)
- Modify: `frontend/components/home/daily-cat-widget.tsx`(图片区 Link + 查看详情按钮)

**Interfaces:**
- Consumes: Task 1 的 `getCats`;`CatBreed` 类型
- Produces: `CatGallery({ cats: CatBreed[] })`(服务端组件)— 首页渲染;详情入口 `/cats/{id}`

- [ ] **Step 1: 创建画廊组件**

```tsx
// frontend/components/home/cat-gallery.tsx
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
```

- [ ] **Step 2: page.tsx 接入(含 Promise.all)**

```tsx
import { CatGallery } from "@/components/home/cat-gallery";
import { DailyCatWidget } from "@/components/home/daily-cat-widget";
import { HeroSection } from "@/components/home/hero-section";
import { QuickLinksSection } from "@/components/home/quick-links-section";
import { getCats, getDailyCat } from "@/lib/api";

export default async function Home() {
  const [dailyCat, cats] = await Promise.all([getDailyCat(), getCats()]);

  return (
    <div className="flex flex-1 flex-col">
      <HeroSection cat={dailyCat.breed} />
      <QuickLinksSection />
      <CatGallery cats={cats} />
      <DailyCatWidget initialData={dailyCat} />
    </div>
  );
}
```

- [ ] **Step 3: 今日猫联动(daily-cat-widget.tsx)**

改动 1 — 图片区包 Link(第 34-42 行区域):

```tsx
      <div className="relative aspect-square w-64 overflow-hidden rounded-4xl border-4 border-card shadow-xl sm:w-80">
        <Link href={`/cats/${data.breed.id}`} className="block h-full w-full">
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
```

改动 2 — import 增加 Link 与 buttonVariants/cn:

```tsx
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
```

改动 3 — 按钮区(替换单个 Button 为并排两个):

```tsx
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
```

> 注:参考 hero-section.tsx 的 `<a className={cn(buttonVariants({ size: "lg" }))}>` 模式——本项目 Button 无 asChild,用 Link + buttonVariants 是既有惯例。

- [ ] **Step 4: 类型 + lint + 构建**

Run: `bunx tsc --noEmit && bun lint && bun run build`
Expected: 全零错误;构建输出含 `/`(动态)与 `/_not-found`

- [ ] **Step 5: 结束任务验证**

```bash
git status --short
```
Expected: 新增 components/home/cat-gallery.tsx,修改 app/page.tsx、components/home/daily-cat-widget.tsx(不提交)

---

### Task 3: 自绘 SVG 雷达图

**Files:**
- Create: `frontend/components/cats/radar-chart.tsx`

**Interfaces:**
- Consumes: `CatScores` 类型
- Produces: `RadarChart({ scores: CatScores })`("use client")— 供 Task 4 详情页使用

- [ ] **Step 1: 创建雷达图组件**

```tsx
// frontend/components/cats/radar-chart.tsx
"use client";

import { motion } from "motion/react";

import type { CatScores } from "@/lib/types/cat";

const DIMENSIONS = [
  { key: "demolition", label: "拆家" },
  { key: "clingy", label: "粘人" },
  { key: "shedding", label: "掉毛" },
  { key: "cost", label: "掉钱包" },
  { key: "looks", label: "颜值" },
] as const;

const SIZE = 260;
const CENTER = SIZE / 2;
const RADIUS = 88;

function polar(index: number, ratio: number): [number, number] {
  const angle = (Math.PI * 2 * index) / DIMENSIONS.length - Math.PI / 2;
  return [
    CENTER + RADIUS * ratio * Math.cos(angle),
    CENTER + RADIUS * ratio * Math.sin(angle),
  ];
}

function polygonPoints(ratio: number): string {
  return DIMENSIONS.map((_, i) => polar(i, ratio).join(",")).join(" ");
}

export function RadarChart({ scores }: { scores: CatScores }) {
  const dataPoints = DIMENSIONS.map((d, i) =>
    polar(i, scores[d.key] / 10).join(",")
  ).join(" ");

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="mx-auto w-full max-w-xs text-foreground"
      role="img"
      aria-label="五维雷达图"
    >
      {/* 满分线、基准 5 分线网格、轴线 */}
      <polygon
        points={polygonPoints(1)}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.18}
        strokeWidth={1}
      />
      <polygon
        points={polygonPoints(0.5)}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.18}
        strokeWidth={1}
        strokeDasharray="4 4"
      />
      {DIMENSIONS.map((d, i) => {
        const [x, y] = polar(i, 1);
        return (
          <line
            key={d.key}
            x1={CENTER}
            y1={CENTER}
            x2={x}
            y2={y}
            stroke="currentColor"
            strokeOpacity={0.18}
          />
        );
      })}

      {/* 数据多边形(奶油马卡龙色 + 入场动画) */}
      <motion.polygon
        points={dataPoints}
        fill="oklch(0.85 0.1 90)"
        fillOpacity={0.4}
        stroke="oklch(0.6 0.15 55)"
        strokeWidth={2}
        strokeLinejoin="round"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />

      {/* 顶点标签:维度名 + 分值 */}
      {DIMENSIONS.map((d, i) => {
        const [x, y] = polar(i, 1.2);
        return (
          <text
            key={d.key}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-muted-foreground text-[12px]"
          >
            {d.label} {scores[d.key]}
          </text>
        );
      })}
    </svg>
  );
}
```

> 实现注意:SVG 内 `motion.polygon` 的 transform 动画原点在 SVG 坐标系 (0,0),因此**入场动画只用 opacity,不用 scale/transform**(避免原点问题)。

- [ ] **Step 2: 类型 + lint**

Run: `bunx tsc --noEmit && bun lint`
Expected: 零错误(`CatScores` 的 key 与 DIMENSIONS 的 key 类型匹配:`as const` + 索引需为 `keyof CatScores`——若 tsc 报类型错,将 DIMENSIONS 声明为 `{ key: keyof CatScores; label: string }[]`)

- [ ] **Step 3: 结束任务验证**

```bash
git status --short
```
Expected: 新增 components/cats/radar-chart.tsx(不提交)

---

### Task 4: 详情页

**Files:**
- Create: `frontend/app/cats/[id]/page.tsx`
- Create: `frontend/app/cats/[id]/not-found.tsx`
- Create: `frontend/components/cats/cat-detail.tsx`

**Interfaces:**
- Consumes: Task 1 的 `getCat`;Task 3 的 `RadarChart`
- Produces: `/cats/{id}` 详情页(404 → not-found)

- [ ] **Step 1: 详情页主体组件**

```tsx
// frontend/components/cats/cat-detail.tsx
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
```

- [ ] **Step 2: 路由页面 + not-found**

```tsx
// frontend/app/cats/[id]/page.tsx
import { notFound } from "next/navigation";

import { CatDetail } from "@/components/cats/cat-detail";
import { getCat } from "@/lib/api";

export default async function CatDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cat = await getCat(id);
  if (!cat) {
    notFound();
  }
  return <CatDetail cat={cat} />;
}
```

```tsx
// frontend/app/cats/[id]/not-found.tsx
import Link from "next/link";

export default function CatNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h2 className="font-heading text-3xl text-foreground">喵呜…没有这只猫</h2>
      <p className="max-w-md text-muted-foreground">
        这个品种不存在或已被删除。
      </p>
      <Link href="/" className="text-sm text-primary underline">
        返回首页
      </Link>
    </div>
  );
}
```

- [ ] **Step 3: 类型 + lint + 构建**

Run: `bunx tsc --noEmit && bun lint && bun run build`
Expected: 零错误;构建路由表含 `/cats/[id]`(ƒ 动态)

- [ ] **Step 4: 结束任务验证**

```bash
git status --short
```
Expected: 新增 3 个文件(不提交)

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
cd ../backend && source .venv/bin/activate && uvicorn main:app --port 8000 > /tmp/e2e_backend.log 2>&1 &
# 前端(frontend 目录)
cd ../frontend && bun dev > /tmp/e2e_frontend.log 2>&1 &
sleep 8
curl -s -o /dev/null -w "backend: %{http_code}\n" http://localhost:8000/api/cats
curl -s -o /dev/null -w "frontend: %{http_code}\n" http://localhost:3000
```
Expected: 两个 200

- [ ] **Step 2: Playwright 验证首页画廊与联动**

用浏览器工具:
1. `browser_navigate` → `http://localhost:3000`
2. `browser_snapshot` → 确认:hero 区、快捷直达 3 卡、"猫咪百科"标题、画廊网格、今日明星猫区块
3. 统计画廊卡片数量(`browser_evaluate`: `document.querySelectorAll('a[href^="/cats/"]').length`)→ 应为 11(品种数)
4. 点击第一张画廊卡 → 进入详情页
5. `browser_snapshot` → 确认:品种名(中/英)、语录、网梗标签、基本信息(起源地/体型/毛发)、适养人群徽章、雷达图 SVG(`browser_evaluate`: `document.querySelectorAll('svg[role="img"][aria-label="五维雷达图"]').length` → 1)
6. `browser_navigate` → `http://localhost:3000/cats/ghost` → 确认 not-found 页("喵呜…没有这只猫")
7. `browser_navigate` → `http://localhost:3000` → 点击今日明星猫图片 → 进入详情页;返回首页;点击"查看详情"按钮 → 进入详情页
8. `browser_console_messages(level: "error")` → 应无错误

- [ ] **Step 3: 响应式抽查 + 收尾**

Run:
```bash
# 移动端宽度检查画廊列数
```
用 `browser_resize`(390×844)→ 刷新首页 → `browser_evaluate`:画廊容器 `gridTemplateColumns` 拆分数应为 2 列
然后:
```bash
grep -icE "error|exception" /tmp/e2e_backend.log /tmp/e2e_frontend.log || echo "logs clean"
kill %1 %2 2>/dev/null
```
Expected: 前后端日志无 error;进程清理

- [ ] **Step 4: 收尾检查**

```bash
git status --short
```
Expected: 新增 components/home/cat-gallery.tsx、components/cats/radar-chart.tsx、components/cats/cat-detail.tsx、app/cats/[id]/(page.tsx + not-found.tsx),修改 app/page.tsx、app/loading.tsx、lib/api.ts、components/home/daily-cat-widget.tsx,均未提交
