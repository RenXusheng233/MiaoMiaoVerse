# MiaoMiaoVerse：Next.js 16 × Fabric.js 前端面试手册

> 适用对象：5 年以上前端经验，熟悉 React/TypeScript，但工作中较少接触 Next.js SEO、缓存更新和 Fabric.js。
>
> 时间安排：总复习计划的 Day 4–5，每天 5–6 小时。本手册不会重复 React 基础，而是集中补齐 App Router 的服务端模型、SEO/revalidate 和 Canvas 编辑器工程化。

## 0. 先明确学习目标

完成后，你应该能独立回答：

1. Server Component 与 Client Component 的边界是什么，`'use client'` 究竟标记了什么？
2. 当前首页为什么能并行取数，`loading.tsx`、Suspense 和流式 HTML/RSC 有什么关系？
3. Next.js 16 开启和不开启 Cache Components 时，缓存模型有什么不同？
4. `revalidatePath`、`revalidateTag`、`updateTag`、`refresh` 和 `router.refresh` 分别解决什么问题？
5. SSR、SSG、缓存和 SEO 是什么关系？为什么“用了 SSR 就一定有好排名”是错误说法？
6. 如何为 `/cats/[id]` 生成 title、description、canonical、Open Graph 和 JSON-LD？
7. Fabric Canvas 为什么不能直接作为 React State？项目中的 `FabricBridge` 解决了什么？
8. Fabric 的对象坐标、缩放、viewport transform、缓存和导出有什么区别？
9. 背景图片为什么会出现旧请求覆盖新请求？跨域图片为什么会让导出失败？
10. 如果画布对象和图片规模增长，如何优化、测试并实现撤销重做？

---

## 1. 从本项目建立全景图

### 1.1 当前技术边界

```text
Next.js 16 App Router
├─ Server Components：页面骨架、百科数据获取、404 边界
├─ Client Components：交互工作区、流式状态、Fabric Canvas
├─ Route segment files：loading.tsx / error.tsx / not-found
├─ lib/api.ts：服务端普通 fetch + 客户端 SSE 入口
└─ FabricBridge：React Schema ↔ Fabric mutable object graph
```

项目中值得直接用于面试的事实：

- `app/page.tsx` 在 Server Component 内并行请求每日猫咪与品种列表，避免顺序 waterfall。
- `app/cats/[id]/page.tsx` 使用 Next.js 16 的异步 `params: Promise<...>`，后端返回 404 后调用 `notFound()`。
- `app/loading.tsx` 和局部 loading 文件给路由切换提供流式 fallback；`app/error.tsx` 是客户端错误边界，可触发重试。
- `lib/api.ts` 的百科请求全部设置 `cache: 'no-store'`，所以每次渲染都访问 FastAPI；当前没有数据 revalidation。
- 根 `layout.tsx` 只有静态 title/description，详情页尚未实现动态 Metadata、canonical、OG、robots、sitemap 和 JSON-LD。
- AI 文案与聊天由浏览器直接读取 FastAPI SSE；这和 Next.js 的 RSC streaming 是两套不同协议。
- 表情包编辑器用 Fabric 7.4；`MemeSchema` 是业务事实来源，`FabricBridge` 隔离可变画布对象。

### 1.2 你已有能力与需要补的能力

| 已有前端经验可直接复用 | 本项目需要补齐 |
| --- | --- |
| React state、effect、组件边界 | RSC 执行位置、序列化边界、Server Action |
| 浏览器渲染与网络请求 | Next.js 多层缓存、失效与刷新语义 |
| SPA 路由与错误处理 | segment loading/error/not-found、流式渲染 |
| HTML 语义与性能 | Metadata API、canonical、robots、sitemap、JSON-LD |
| TypeScript discriminated union | Fabric 可变对象、坐标系、事件、序列化与缓存 |
| AbortController 与 Stream | SSE frame 解析、断连、后端取消 |

---

## 2. App Router 与 React Server Components

### 2.1 Server Component 不是“没有 React 的 SSR”

App Router 中组件默认是 Server Component。它在服务端执行，可以直接读取服务端数据源和 secret，输出 RSC Payload；浏览器使用该 Payload 协调 Server/Client 树，并对 Client Component 完成 hydration。

需要区分三个概念：

- **Server Component**：组件在哪里执行、哪些代码进入客户端 bundle。
- **SSR/预渲染**：初始访问时是否先生成 HTML。
- **Streaming**：服务器是否分块发送可用内容，而不是等整棵树完成。

Server Component 可以被预渲染，也可以按请求动态执行；Client Component 首屏也可能有服务器生成的 HTML。因此不要说“Client Component 就没有 SSR”。

### 2.2 `'use client'` 是模块图边界

它声明这个文件及其客户端依赖进入 client graph，并不是要求每个子组件都重复写。跨越边界的 props 必须可以序列化，不能把数据库连接、普通回调函数或 Fabric 实例从 Server Component 传给客户端。

本项目中 Fabric Canvas 依赖 DOM 和浏览器 2D Canvas，因此必须位于客户端边界；猫咪详情数据则可以先由 Server Component 获取，再把普通 JSON props 交给展示组件。

边界设计原则：

- 尽量让数据获取和不需要交互的布局留在服务端。
- 把最小交互岛标成客户端，而不是把整页都变成 Client Component。
- 浏览器专用库可在 Client Component 的 effect 中初始化，必要时动态加载以降低初始 bundle。

### 2.3 数据获取：并行、顺序和 Suspense

独立请求应尽早创建并并行等待；有依赖的数据才按顺序：

```tsx
export default async function Page() {
  const [dailyCat, cats] = await Promise.all([getDailyCat(), getCats()])
  return <Home dailyCat={dailyCat} cats={cats} />
}
```

如果慢模块不应阻塞整个页面，可将其放进独立 async component，并用 Suspense 包围。`loading.tsx` 相当于 Next.js 为整个 route segment 自动建立 Suspense fallback；更细粒度的 Suspense 能让页面骨架先返回。

面试时要补充：并行并不等于请求一定更快，它减少的是可避免的等待链；仍需要处理下游连接数、限流、超时和部分失败。

### 2.4 `error.tsx`、`notFound()` 与状态语义

- `error.tsx` 必须是 Client Component，因为它提供错误 UI 和 `reset()`。
- `notFound()` 用于资源不存在，终止当前 segment 渲染并呈现 `not-found` UI，同时影响响应/SEO 语义。
- 预期业务错误应被转换成明确状态；不要把所有后端 4xx/5xx 都变成同一个通用 Error。
- 流开始后才发生的错误可能无法再修改已经发送的 HTTP status，因此页面内错误状态同样重要。

### 2.5 两种“流式”不要混为一谈

| 项目中的机制 | 发送内容 | 消费者 | 主要用途 |
| --- | --- | --- | --- |
| Next.js/RSC streaming | HTML + RSC Payload 的分块 | React/Next Router | 页面逐步可见、Suspense reveal |
| FastAPI SSE | `event:` / `data:` 文本帧 | 自定义 `fetch` + ReadableStream parser | LLM token 与业务事件 |

本项目用 `fetch` 而非原生 `EventSource`，是因为请求需要 POST body、AbortSignal 和自定义 headers；原生 EventSource 主要面向 GET，控制能力有限。

---

## 3. Next.js 16 缓存与 revalidate

### 3.1 先回答当前项目到底有没有缓存

当前 `next.config.ts` 未开启 `cacheComponents`，`lib/api.ts` 又对所有百科 fetch 使用 `cache: 'no-store'`。因此结论是：

> 目前百科数据按请求动态获取，没有使用 Next Data Cache，也没有 `revalidatePath`/`revalidateTag`。这样数据一致性直观，但每次访问都会增加 FastAPI 与 PostgreSQL 压力，页面 TTFB 也受后端延迟影响。

不要在面试中把“Next.js 支持缓存”说成“项目已经用了缓存”。可以继续说，如果品种数据更新频率低，会把它演进成带 tag 的共享缓存；随机猫和用户私有数据继续动态获取。

### 3.2 Next.js 16 要先辨认缓存模式

Next.js 16 文档存在两套需要按项目配置区分的模型：

1. **Cache Components 开启**：在 `next.config.ts` 设置 `cacheComponents: true`，使用 `'use cache'`、`cacheLife`、`cacheTag`。动态请求数据通常放进 Suspense，静态外壳与缓存内容可组合成 Partial Prerendering。
2. **未开启 Cache Components**：沿用 `fetch` 的 `cache`/`next.revalidate`/`next.tags`，以及必要时的 `unstable_cache`。本项目当前属于此模式，但选择了 `no-store`。

面试时先说明版本和配置，再谈 API；不要把不同版本博客中的行为拼在一起。

### 3.3 Cache Components 模式示例

```ts
import { cacheLife, cacheTag } from 'next/cache'

export async function getCatsCached() {
  'use cache'
  cacheLife('hours')
  cacheTag('cats')
  return fetchCatsFromBackend()
}
```

`'use cache'` 可以放在函数或组件中。缓存键会考虑构建 ID、函数标识和可序列化参数；闭包捕获值也会成为键的一部分。缓存函数不要直接读取 `cookies()`、`headers()` 等请求数据，应在外层读取后以参数传入，或者把真正私有的部分保持动态。

### 3.4 五个容易混淆的更新 API

| API | 调用位置 | 是否使缓存失效 | 用户体验/适用场景 |
| --- | --- | --- | --- |
| `revalidateTag(tag, 'max')` | Server Action、Route Handler | 是，按 tag 标脏 | 推荐 SWR：下次先给旧值，后台刷新；Webhook 很合适 |
| `updateTag(tag)` | 仅 Server Action | 是，立即过期 | 写后立刻读到自己的更新，牺牲一次等待 |
| `revalidatePath(path)` | Server Action、Route Handler | 是，按页面或布局路径 | 某个 URL 树受数据变更影响时使用 |
| `refresh()` | 仅 Server Action | 否 | 请求客户端 Router 刷新，但不改变缓存规则 |
| `router.refresh()` | Client Component | 否 | 客户端重新请求当前 RSC Payload；命中缓存时仍可能得到缓存数据 |

核心判断：**刷新视图不等于使缓存失效，使缓存失效也不一定要求阻塞用户等待新值。**

### 3.5 `revalidateTag` 与 `updateTag` 的面试级区别

假设后台修改了一只猫的资料：

- 管理后台 Server Action 完成写入后，希望操作者立即看到新值：`updateTag('cat:ragdoll')`，满足 read-your-own-writes。
- 外部 CMS Webhook 通知内容变化，公开访问者可短暂看到旧缓存：Route Handler 调用 `revalidateTag('cat:ragdoll', 'max')`，采用 stale-while-revalidate，减少缓存击穿。
- 同时需要让列表和详情受影响：分别设计 `cats` 与 `cat:${id}` 标签，按实体依赖失效；不要只依赖一个覆盖全站的粗粒度 tag。

### 3.6 未开启 Cache Components 的项目如何改造

如果保持当前模式，可以先将稳定百科数据从 `no-store` 改为：

```ts
await fetch(`${API_BASE_URL}/api/cats`, {
  next: { revalidate: 3600, tags: ['cats'] },
})
```

详情使用 `tags: ['cats', `cat:${id}`]`。管理写入后按 tag 更新。随机内容、LLM 流、依赖身份的内容通常不应直接共享缓存。

改造前要定义：

- 允许数据旧多久，即业务 freshness SLA。
- 是按时间刷新、事件驱动失效，还是两者结合。
- 失败时可否继续展示 stale data。
- 多实例部署时缓存和失效信号如何共享。
- 如何监控 cache hit ratio、回源延迟和失效风暴。

### 3.7 常见陷阱

- 把 `router.refresh()` 当成清缓存。
- 用户 A 的权限化数据使用无区分的共享缓存键，导致数据泄露。
- 每条数据都设置极短 TTL，最后既没有缓存收益又增加复杂度。
- 写入数据库后只刷新当前页面，却忘记列表、详情、sitemap 和 OG 等依赖。
- 在一个缓存函数中混入时间、随机数或隐式请求上下文，造成错误复用或大量缓存键。
- 缓存了 404/异常但没有明确负缓存策略。

---

## 4. SEO：从可抓取到可理解

### 4.1 SEO 不是一个 `<title>` 标签

技术 SEO 可以分成四层：

```text
抓取得到：robots、链接、sitemap、状态码、无登录阻挡
建立索引：canonical、noindex、重复内容与稳定 URL
理解内容：title、description、语义 HTML、结构化数据、语言
展示与体验：OG/Twitter、图片、Core Web Vitals、移动端体验
```

SSR/预渲染有助于爬虫直接得到内容和链接，但不能保证收录，更不能保证排名。内容质量、站点权威、重复内容和性能仍然重要。

### 4.2 Metadata API

根布局适合定义默认值和 title template：

```tsx
export const metadata: Metadata = {
  metadataBase: new URL('https://example.com'),
  title: {
    default: '喵喵宇宙',
    template: '%s | 喵喵宇宙',
  },
  description: '猫咪百科、AI 文案与表情包工具。',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    siteName: '喵喵宇宙',
  },
}
```

静态内容用 `metadata`，依赖 params/数据的页面用 `generateMetadata`。二者只能在 Server Component 中导出。Next.js 可流式发送动态 metadata，但对只接受 HTML head 的受限 bot 会采用兼容处理；应用仍应保证 metadata 获取快速、可靠。

### 4.3 为猫咪详情页设计动态 Metadata

```tsx
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const cat = await getCat(id)
  if (!cat) return { title: '未找到猫咪', robots: { index: false } }

  return {
    title: `${cat.name}品种介绍`,
    description: `${cat.name}的性格、外观、养护建议与适合人群。`,
    alternates: { canonical: `/cats/${id}` },
    openGraph: {
      type: 'article',
      title: `${cat.name}品种介绍`,
      images: [cat.image_url],
    },
  }
}
```

实际实现要避免 `generateMetadata` 和页面分别回源两次。可依靠框架对相同 fetch 的去重/缓存，或把数据函数设计成明确的 memoized/cacheable 边界；同时保证不存在时页面调用 `notFound()`，不要返回一个 HTTP 200 的“找不到”页面形成 soft 404。

### 4.4 canonical、robots 和 sitemap

- **canonical**：声明多个相似 URL 中希望被索引的主版本，不是跳转，也不保证搜索引擎绝对服从。分页/筛选页不能全部无脑 canonical 到首页。
- **robots.txt**：控制爬虫抓取路径，不等于阻止已知 URL 被索引；敏感信息必须靠鉴权，阻止索引使用 `noindex`。
- **sitemap.xml**：帮助发现重要 URL，并可给出更新时间；它不能替代站内可抓取链接，也不保证收录。
- Next.js 可使用 `app/robots.ts` 和 `app/sitemap.ts` 生成对应文件；大量 URL 时可拆分 sitemap。

适合本项目的 sitemap 至少包括首页、百科列表和每个猫咪详情页；AI 会话、临时生成结果和个人编辑器不应被索引。

### 4.5 JSON-LD 结构化数据

JSON-LD 帮助搜索引擎理解实体，但必须与页面可见内容一致，不能伪造评分或使用不匹配的 schema。可在详情页输出 `Article` 或更贴近实际内容的类型。

```tsx
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: `${cat.name}品种介绍`,
  image: cat.image_url,
}

<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
  }}
/>
```

替换 `<` 是为了避免不可信字符串提前闭合 script 标签。结构化数据上线前应使用搜索引擎的 Rich Results Test 验证。

### 4.6 性能、图片与内容语义

- 首屏主图用 `next/image` 提供尺寸、现代格式和响应式资源，避免 CLS；不要给大量非首屏图片都设置高优先级。
- 字体用 `next/font` 降低外部阻塞和布局偏移；本项目已使用这一能力。
- 重要内容和链接应存在于服务端输出，而不是必须点击后才从客户端生成。
- 使用唯一、描述性的 H1，保持标题层级和语义元素；图片 alt 描述内容与用途，不堆砌关键词。
- 关注 LCP、INP、CLS，但性能是搜索体验信号之一，不应替代内容建设。
- 404、重定向和 canonical 应保持一致，HTTP 语义比仅在 UI 中显示提示更可靠。

### 4.7 本项目 SEO 改造优先级

| 优先级 | 改造 | 原因 |
| --- | --- | --- |
| P0 | 生产域名 `metadataBase`、title template、详情 `generateMetadata` | 先让每页有独立且可解析的基本信息 |
| P0 | `robots.ts`、`sitemap.ts`、正确 404 | 保证抓取发现与状态语义 |
| P1 | canonical、OG/Twitter 图 | 控制重复 URL 与社交分享表现 |
| P1 | 详情 JSON-LD | 增强实体理解，需与可见内容一致 |
| P1 | 稳定百科数据缓存与按实体 tag 失效 | 改善 TTFB 并降低回源 |
| P2 | Core Web Vitals、图片尺寸与真实用户监控 | 用数据定位性能瓶颈 |
| P2 | 多语言 alternates/hreflang | 只在真正存在独立语言页面时添加 |

---

## 5. Fabric.js 核心模型

### 5.1 为什么用 Fabric，而不是直接写 Canvas 2D

原生 Canvas 是立即模式：画完后像素留在画布上，浏览器不替你维护“这个文本对象被选中”。Fabric 在其上维护对象场景图，提供对象变换、选择框、控制点、命中测试、序列化和导出。

代价是：它维护一套可变对象系统和缓存机制，与 React 的声明式状态并不天然一致；高级定制还会触及内部渲染方法。

### 5.2 `Canvas`、`StaticCanvas` 与 FabricObject

- `Canvas`：交互式容器，处理选择、鼠标/触摸、对象栈、viewport、渲染与导出。
- `StaticCanvas`：不需要交互层时使用，适合服务端外的静态合成或只读预览。
- `FabricObject`：`Textbox`、`Circle`、`Path`、`FabricImage` 等对象基类，包含位置、尺寸、scale、angle、origin、opacity、cache 等状态。
- ActiveSelection/Group 表达多选或分组；分组后的坐标与变换会嵌套，不能继续把 child 的 `left/top` 当成画布绝对坐标。

本项目使用命名导入，这是 Fabric 7 的 API 形态；旧教程里的 `fabric.Canvas` namespace、回调式 `Image.fromURL` 和旧事件名可能不适用。

### 5.3 三套坐标必须分清

```text
对象局部坐标 -- object transform --> scene/canvas coordinates
scene coordinates -- viewport transform --> screen coordinates
screen/CSS pixels -- retina scaling --> backing-store pixels
```

- `left/top` 与 `originX/originY` 共同决定对象锚点位置。
- `width/height` 通常是未缩放几何尺寸，视觉尺寸要看 `scaleX/scaleY`；可用 `getScaledWidth()` 等方法。
- viewport transform 用于整个画布的 zoom/pan，不应把每个对象都改坐标来模拟缩放。
- CSS 缩放 DOM 只改变显示，不必然改变场景坐标或导出分辨率。本项目用 wrapper CSS transform 适配视口，同时让 Fabric 的上下两层 canvas 一起缩放。
- retina/backing store 影响清晰度、缓存和导出内存，不能只看 `<canvas width>` 的 CSS 尺寸。

面试题“旋转后的对象怎么求包围盒”不能只答 `left + width`。要考虑 origin、scale、angle、stroke，优先使用 Fabric 提供的坐标与 bounding rect API。

### 5.4 React 与 Fabric 的核心冲突

React 偏向 immutable state → render；Fabric 对象则通过 `set()` 原地更新，并由 Canvas 主动重绘。如果 React 每次 state 更新都清空并重建画布，会造成：

- 选择态和编辑光标丢失。
- 大量对象分配与图片重载。
- React 更新触发 Fabric 事件，Fabric 事件再写 React，形成反馈环。
- 难以区分用户拖动与程序同步。

本项目的解决方案是：

```text
MemeSchema（业务事实来源）
        ↓ command
FabricBridge.update/add/remove
        ↓ set + render
Fabric Canvas（交互投影）
        ↓ object:modified
FabricBridge mapping
        ↓ immutable copy
React state / 属性面板
```

`MemeSchema` 使用 discriminated union 表示 text/bubble/emoji/shape，稳定 ID 通过 `customId` 映射到 Fabric 对象。Fabric 对象只保存渲染与交互投影，不承担所有应用数据。这与 Fabric 官方“不把 FabricObject 当通用应用 datastore”的建议一致。

### 5.5 为什么要通过 `set()` 更新

项目没有对 Fabric 对象直接 `Object.assign`，而是重新映射完整 options 后调用 `fobj.set(...)`。原因是 Fabric 的 setter 会处理 dirty 标志与缓存失效；直接写属性可能让数据变了但 bitmap cache 仍旧，直到下一次交互才刷新。

这是一条可迁移原则：与第三方可变状态库交互时，使用它公开的 mutation API，让内部不变量、事件和缓存能正确维护。

---

## 6. Fabric 生命周期、事件与异步资源

### 6.1 初始化与释放

Canvas 应在 DOM mount 后创建，并在 cleanup 时解除事件、作废异步任务、释放 Canvas。React Strict Mode 开发环境可能重复 mount/effect，用生命周期幂等性检查比“只在我机器运行一次”更可靠。

需要检查：

- 是否保存事件 disposer，或在销毁时精确 `off` 自己注册的 handler。
- `canvas.dispose()` 后是否仍可能有 `fromURL().then(...)` 回写。
- 文件读取、图片 decode 和导出 Promise 是否能在卸载后触发 React state update。
- 第三方 listener 是否因闭包捕获旧 schema 而 stale。

项目当前通过 `backgroundLoadSeq` 解决“慢旧图覆盖快新图”：每次请求递增序号，Promise 完成时只接受最新序号。这是 take-latest，而非真正取消网络请求；销毁时还应让所有完成回调失效。

### 6.2 事件系统怎么用

Fabric 事件可以从对象与 Canvas 观察交互。项目监听：

- `selection:created`：从无选择到选中。
- `selection:updated`：直接从一个对象切换到另一个对象；Fabric 7 旧教程的事件名可能不同。
- `selection:cleared`：清空选择。
- `object:modified`：移动、缩放、旋转或文本编辑完成后回写 Schema。

官方建议：事件适合观察已经发生的 Fabric 行为；如果应用自己的按钮明确执行“删除对象”，直接调用 `removeObject()`，不要绕成自定义事件再监听。高频 `object:moving/scaling` 可用于实时 UI，但写 React state 前要节流；只需最终值时用 `object:modified`。

### 6.3 图片加载、cover 与跨域

本项目背景图 cover 比例是：

```text
scale = max(canvasWidth / imageWidth, canvasHeight / imageHeight)
left  = (canvasWidth  - scaledWidth)  / 2
top   = (canvasHeight - scaledHeight) / 2
```

`max` 保证两边都覆盖，溢出部分居中裁切；`min` 对应 contain，会留空白。

跨域图片如果服务器没有允许 CORS，绘制后 Canvas 会被标记为 tainted，之后 `toDataURL()`/`toBlob()` 抛 SecurityError。设置 `crossOrigin: 'anonymous'` 只有在图片服务器返回正确 CORS header 时才有效。生产系统通常应使用受控对象存储、图片代理或上传后同源访问，而不是信任任意 URL。

### 6.4 自定义 `RoundedTextbox`

项目通过继承 `Textbox` 并覆盖 `_renderBackground` 绘制带圆角、padding 和 border 的气泡，同时扩展 `cacheProperties`，并重写 cache canvas 尺寸避免背景被裁剪。

这个实现可以展示三个高级点：

1. 自定义属性变化必须使对象缓存变 dirty，否则不会重绘。
2. 自定义绘制超出原始对象 bounds 时，需要扩大 cache bounds 与命中/导出预期。
3. `_renderBackground`、`_getCacheCanvasDimensions` 属于较底层扩展点，升级 Fabric 时应有视觉回归测试；若需要 JSON 反序列化，还要处理 subclass 注册和自定义属性。

### 6.5 序列化策略

Fabric 的 `toObject()`/`toJSON()` 可以保存视觉状态，`loadFromJSON()` 恢复对象，但函数、事件 listener 和所有业务行为不会自动恢复。自定义属性需显式加入序列化列表并扩展 TypeScript 类型。

本项目优先保存 `MemeSchema` 而不是 Fabric JSON，有这些优势：

- 数据结构只包含业务需要的稳定字段，版本迁移可控。
- 不被 Fabric 内部属性和版本变化绑定。
- 属性面板、后端持久化和测试可以完全不 import Fabric。
- 仍可按需从 Schema 重建画布。

要进一步生产化，应给 Schema 添加 `version`，写迁移函数，并验证未知 object type、极端数值和字体资源。

---

## 7. 渲染、缓存、导出与性能

### 7.1 `renderAll()`、`requestRenderAll()` 与对象缓存

- `renderAll()` 立即执行重绘。
- `requestRenderAll()` 将多个变化合并到下一帧，适合连续更新。
- Fabric 对象缓存会把对象先绘制到离屏 canvas；复杂对象移动时可复用，但缓存本身消耗内存，并存在尺寸上限与失效成本。
- 对象属性变化后应通过 `set()` 让 dirty 状态正确更新。

项目当前多个命令在一次操作里可能调用多次 `renderAll()`，对象少时没问题；规模增长后可批量 mutation，并只请求一次 render。

### 7.2 导出不是截图 DOM

项目导出前先 `discardActiveObject()`，避免选择控制点进入 PNG，然后 `canvas.toDataURL({ format: 'png', multiplier: 1 })`。圆角使用临时 Canvas 的 `destination-in` 后处理，避免 Fabric clipPath cache 与不同导出分辨率不一致。

需要能解释：

- `multiplier` 改变导出像素尺寸与内存，宽高翻倍意味着像素量约四倍。
- Data URL 会做 Base64 膨胀并长期占用 JS 字符串内存；大图上传优先 `toBlob()`。
- 导出应基于逻辑画布尺寸，而不是页面为了适配容器使用的 CSS scale。
- 字体未加载完成、图片 decode 未完成或 CORS 失败都会让导出和屏幕预览不一致。
- 连续导出应释放 Object URL，必要时放到 Worker/OffscreenCanvas；但 Fabric 交互主流程仍依赖 DOM，需要先验证兼容性。

### 7.3 性能排查顺序

1. 用 Performance/React Profiler 区分是 React re-render、Fabric render、图片 decode 还是导出编码慢。
2. 统计对象数、画布像素、缓存内存、单帧耗时和事件频率。
3. 把高频拖动与最终提交分离，属性面板按帧节流。
4. 避免无变化的全量 `renderAll()` 与全量 deep clone；但优化前先保证 Schema 与画布一致性。
5. 图片进入画布前按最大需求尺寸解码/缩放，不要把数千万像素原图当小背景。
6. 对复杂 SVG/path、阴影、滤镜和大量文本做实测，它们比简单矩形昂贵。
7. 再考虑分层、离屏渲染、Worker 或替代渲染引擎。

### 7.4 Undo/Redo 设计

两种常见方案：

- **Schema snapshot**：每次用户完成操作后保存 immutable Schema。实现简单、确定性强，适合当前对象少的项目；连续拖动只在 `object:modified` 时记一次。
- **Command + inverse command**：记录 add/remove/update 的前后差异，内存更省、可合并操作，但实现和异常恢复更复杂。

不要直接每个 `object:moving` event 存一份 Fabric JSON。当前项目以 Schema 为事实来源，snapshot 是最自然的第一版；限制历史长度并对大图片只保存引用。

### 7.5 测试分层

- **纯函数单测**：`schemaToFabricOptions`、`fabricPropsToSchema`、cover 计算、Schema migration。
- **Bridge 集成测试**：add/update/remove、选择同步、对象修改回写、慢图片竞态、destroy 后不回写。
- **浏览器 E2E**：真实拖拽、缩放、编辑文本、导出 PNG、CORS 错误提示。
- **视觉测试**：只覆盖少量关键模板和自定义 RoundedTextbox，避免大量脆弱的像素快照。

Canvas 的 DOM 断言价值有限；关键是业务 Schema、可观察交互结果和少量导出图。

---

## 8. 技术选型对比

### 8.1 Fabric vs Konva vs 原生 Canvas/SVG

| 方案 | 优点 | 代价 | 适合本项目吗 |
| --- | --- | --- | --- |
| Fabric | 文本编辑、选择控制、对象序列化和导出开箱较完整 | 可变对象模型；高级定制依赖内部机制 | 是，表情包编辑器以对象编辑为主 |
| Konva | scene graph、事件、React 绑定体验较强 | 原生可编辑文本需额外 DOM overlay；迁移成本 | 若重视 React 声明式和图形交互可评估 |
| 原生 Canvas 2D | 控制最细、无库包袱 | 命中、控制点、文本编辑、序列化全要自建 | 当前需求投入不划算 |
| SVG/DOM | 可访问性、文本与 CSS 调试友好 | 超多节点/滤镜性能、像素级导出和复杂交互有成本 | 简单海报编辑器可选 |

正确回答不是“Fabric 性能最好”，而是它对本项目的文本编辑、对象控制与 PNG 导出需求覆盖度高。若未来主要做上万对象、WebGL 滤镜或协同白板，需要重新压测和选型。

### 8.2 RSC fetch vs 浏览器 fetch

- 公开百科：服务端获取有利于初始内容、密钥隔离、缓存和 SEO。
- LLM SSE：浏览器直连 FastAPI 可减少 Next 中转层，并直接控制 AbortSignal；但需要处理跨域、鉴权、限流和后端地址暴露。
- 若鉴权必须使用 HttpOnly cookie、需要同域策略或隐藏后端，可增加 Next Route Handler/BFF；代价是多一跳和流式代理复杂度。

---

## 9. 高频面试题与参考回答

### Q1：RSC 和 SSR 有什么区别？

RSC 描述组件在服务端执行及传输 RSC Payload，SSR 描述初始 HTML 的生成时机。两者可组合；Client Component 首屏也可预渲染 HTML，再 hydration。

### Q2：`'use client'` 会让整页都变 CSR 吗？

不会。它建立客户端模块图边界。该模块及依赖进入客户端 bundle，但页面仍可由 Server Component 组合，并生成首屏 HTML。

### Q3：为什么 params 要 await？

Next.js 16 App Router 的动态 APIs 使用异步接口，本项目把 `params` 标为 Promise 并 await，符合当前版本语义；旧版本同步示例不能直接照搬。

### Q4：`loading.tsx` 和手写 Suspense 怎么选？

`loading.tsx` 给整个 segment 自动提供导航 fallback；手写 Suspense 适合将某个慢模块隔离，让静态/快速内容更早显示。二者可以同时使用。

### Q5：当前页面缓存了吗？

当前 API fetch 全是 `no-store` 且未开启 Cache Components，所以百科数据每次回源。浏览器/CDN 可能还有独立 HTTP 缓存规则，但项目代码没有声明 Next Data Cache。

### Q6：`router.refresh()` 为什么看不到新数据？

它只重新请求当前路由的 Server Component Payload，不主动使 Data Cache 失效。如果数据仍命中旧缓存，需要先用 tag/path API 失效，或调整缓存策略。

### Q7：`revalidateTag(tag, 'max')` 和 `updateTag`？

前者是 SWR，可在 Server Action/Route Handler 使用，访问者可先收到 stale 值再后台刷新；后者仅 Server Action，立即过期，适合写后立即读到自己的更新。

### Q8：什么时候用 `revalidatePath`？

当变更的影响天然按 URL/布局树表达时使用；实体被多个页面消费时 tag 更精确。两者可以组合，而不是二选一。

### Q9：SSR 为什么有利于 SEO？

它让初始响应包含可读内容与链接，降低爬虫执行客户端 JS 的依赖。但是否索引和排名还受状态码、canonical、内容质量、重复内容、站点链接和体验影响。

### Q10：robots.txt 能保护隐私页面吗？

不能。它是给爬虫的抓取指令，不是访问控制。敏感页面必须鉴权，需要阻止索引时再使用 noindex 等 SEO 控制。

### Q11：动态详情页的 SEO 怎么做？

Server Component 用 `generateMetadata` 获取实体 title/description/canonical/OG；不存在时真实 404；输出与页面一致的 JSON-LD，并放入 sitemap 和站内链接。

### Q12：metadata 获取失败怎么办？

要设置下游超时和可靠 fallback，避免 metadata 成为首屏瓶颈；数据获取最好与页面共享去重/缓存策略，同时不能用空泛 title 掩盖资源不存在。

### Q13：为什么 Fabric 不能直接放 React state？

Fabric 实例包含可变状态、DOM/canvas 引用、方法和事件，既不可序列化也不适合 immutable diff。项目保存业务 Schema，Fabric 仅是投影，通过 Bridge 双向同步。

### Q14：为什么对象更新必须调用 `set()`？

它会维护 Fabric 内部 setter 语义、dirty 标志和 bitmap cache。直接赋值可能让缓存不失效，出现数据已变但画面延迟刷新的问题。

### Q15：`left/top` 是对象左上角吗？

不一定，取决于 origin；还要考虑 scale、angle、group 和 viewport transform。计算碰撞/包围盒应使用 Fabric 坐标 API，而不是手工 `left + width`。

### Q16：为什么旧背景图会覆盖新图？

图片 Promise 完成顺序不保证与发起顺序一致。项目用单调序号实现 take-latest，只有最新请求允许写 canvas；更完整方案还要在组件销毁后禁止回写。

### Q17：为什么导出时报 tainted canvas？

画布绘制了没有正确 CORS 响应的跨域图片，浏览器为防止像素窃取禁止读取。仅加 `crossOrigin` 不够，图片服务器也必须允许来源。

### Q18：为什么不用 Fabric JSON 作为数据库结构？

它混入库的内部视觉字段且受版本影响，业务迁移和验证困难。本项目 Schema 更小、更稳定、可测试；Fabric JSON 只适合明确接受这种耦合的视觉快照。

### Q19：如何优化拖拽卡顿？

先 profile；降低高频 React state 写入，用 `requestRenderAll` 合并帧，控制对象/图片尺寸与缓存，避免全量重建和 deep clone，最后再考虑 Worker 或换引擎。

### Q20：如何实现撤销重做？

当前以 immutable Schema 为事实来源，可在每个完成操作建立 snapshot，拖动只在 `object:modified` 记一次；规模大后再演进成 command/inverse command。

---

## 10. Day 4–5 学习安排

### Day 4：Next.js 16、缓存与 SEO（5.5 小时）

1. **RSC/App Router（75 分钟）**：Server/Client boundary、RSC Payload、SSR、hydration、Suspense、error/not-found。
2. **源码（45 分钟）**：追踪 `app/page.tsx`、`cats/[id]/page.tsx`、`loading.tsx`、`error.tsx` 和 `lib/api.ts`。
3. **缓存实验（75 分钟）**：分别写 no-store、定时 revalidate、tag cache；模拟更新后对比 `revalidateTag`、`updateTag`、`router.refresh`。
4. **SEO 实践（75 分钟）**：为详情页手写 `generateMetadata`，设计 robots/sitemap/canonical/JSON-LD，不要求立刻改项目代码。
5. **口述（60 分钟）**：回答 Q1–Q12；画出一次首次访问、一次缓存命中和一次 tag 失效链路。

验收：不查资料完成五个刷新/失效 API 对比表，并准确描述当前项目的真实缓存和 SEO 状态。

### Day 5：Fabric.js 与编辑器工程化（5.5 小时）

1. **核心模型（75 分钟）**：Canvas、FabricObject、坐标/transform、事件、对象缓存、序列化。
2. **源码（75 分钟）**：阅读 Schema、mapping、Bridge、CanvasStage、StudioWorkspace，画双向数据流。
3. **手写实验（90 分钟）**：不用复制源码，实现矩形/文本的增删改、拖动回写、take-latest 图片、PNG Blob 导出。
4. **设计练习（45 分钟）**：给当前编辑器设计 undo/redo、Schema version 和三层测试方案。
5. **口述（45 分钟）**：回答 Q13–Q20；讲清 RoundedTextbox、缓存 dirty 和导出后处理。

验收：能解释坐标与缓存 bug，而不只会调用 `canvas.add()`；能从 React/Fabric 状态冲突出发说明 Bridge 的价值。

---

## 11. 必做练习与自测

### 必做练习

1. 闭卷画 Server Component、Client Component、FastAPI、SSE 的边界。
2. 为猫咪详情写一份动态 Metadata 草稿，并列出 404、canonical、JSON-LD 验证项。
3. 用一个假数据源演示 tag SWR 和写后 `updateTag`，记录连续两次请求读到什么。
4. 手算一张 800×600 图片 cover 到 500×500 画布后的 scale、尺寸、left/top。
5. 实现 Fabric 对象拖动后仅提交一次 undo snapshot。
6. 用错误 CORS 图片复现 tainted canvas，再写出正确的服务端解决条件。
7. 比较 1x、2x、4x 导出的像素量、耗时和内存，而不是只看清晰度。

### 最终自测

- [ ] 我能说明当前项目哪些代码在服务端、哪些在浏览器。
- [ ] 我能区分 RSC streaming 与 LLM SSE。
- [ ] 我能说明当前 `no-store` 的收益和代价。
- [ ] 我能按 Next.js 16 配置选择正确缓存模型。
- [ ] 我能区分 refresh、path invalidation、tag SWR 和 immediate expiry。
- [ ] 我能完成详情页技术 SEO 设计，并说明 SEO 不等于 SSR。
- [ ] 我能画出 Schema、Bridge、Fabric Canvas、React 属性面板的数据流。
- [ ] 我能解释对象坐标、viewport、CSS scale 与 retina scale。
- [ ] 我能解释自定义 Fabric 属性为什么影响 cacheProperties。
- [ ] 我能处理图片异步竞态、CORS、导出内存和组件销毁。
- [ ] 我能提出可验证的性能优化，而不是笼统地说“减少渲染”。

---

## 12. 官方资料阅读顺序

以项目本地的 Next.js 16 文档为版本基准：`frontend/node_modules/next/dist/docs/`。在线链接用于复习和更新。

1. [Next.js：Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
2. [Next.js：Fetching Data](https://nextjs.org/docs/app/getting-started/fetching-data)
3. [Next.js：Cache Components](https://nextjs.org/docs/app/getting-started/partial-prerendering)
4. [Next.js：Revalidating](https://nextjs.org/docs/app/getting-started/revalidating)
5. [Next.js：Caching and Revalidating（未开启 Cache Components）](https://nextjs.org/docs/app/guides/caching-without-cache-components)
6. [Next.js：Metadata and OG Images](https://nextjs.org/docs/app/getting-started/metadata-and-og-images)
7. [Next.js：`generateMetadata`](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
8. [Next.js：`revalidateTag`](https://nextjs.org/docs/app/api-reference/functions/revalidateTag)
9. [Next.js：`updateTag`](https://nextjs.org/docs/app/api-reference/functions/updateTag)
10. [Next.js：`revalidatePath`](https://nextjs.org/docs/app/api-reference/functions/revalidatePath)
11. [Next.js：Production Checklist](https://nextjs.org/docs/app/guides/production-checklist)
12. [Fabric.js：Core Concepts](https://fabricjs.com/docs/core-concepts/)
13. [Fabric.js：Events](https://fabricjs.com/docs/events/)
14. [Fabric.js：Custom Properties](https://fabricjs.com/docs/using-custom-properties/)
15. [Fabric.js API](https://fabricjs.com/api/)
16. [Google Search：SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
17. [Google Search：Structured Data](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data)

阅读 Fabric 文档时要核对 7.x API。遇到旧文章先验证导入方式、事件名、Promise API 和类型名称，不要为迎合旧教程降级当前实现。
