# 猫咪百科前端(PRD 3.2)+ 首页联动设计文档

> 前端实现 3.2 猫咪百科:详情页 + 首页品种画廊 + 自绘 SVG 雷达图;3.1 与 3.2 联动(今日猫可点、首页充实)。

## 背景

- 后端 3.2 API 已就绪:`GET /api/cats`(列表/筛选)、`GET /api/cats/{id}`(详情,含 ai_scores 合并分值)
- 前端已有:首页(hero + 快捷直达 + 今日明星猫)、`app/error.tsx` / `app/loading.tsx`、`lib/api.ts`(getDailyCat/getRandomCat)、`lib/types/cat.ts`(CatBreed 全字段)
- 缺口(用户提出):首页无进入百科详情的入口;首页空旷;3.1 与 3.2 联动弱
- 3.3-3.5 已有快捷直达路由跳转,不在本次范围

## 核心决策

| 决策 | 选择 |
| --- | --- |
| 联动方式 | 今日明星猫可点击进详情 + 首页新增全品种画廊(解决入口与空旷) |
| 画廊形态 | 首页展示全部品种,响应式网格;**不做独立列表页与筛选**(后端已支持,后续需要时加) |
| 雷达图 | **自绘 SVG**(五维规则多边形,零依赖、风格可控);不用 ECharts/Recharts |
| 架构 | 延续现有 RSC 模式:服务端获取数据,仅雷达图是客户端组件 |
| 详情页路由 | `app/cats/[id]/page.tsx`,`params` 为 Promise(Next.js 16),不存在 → `notFound()` |

## 文件结构

```
frontend/
├── app/
│   ├── page.tsx                 # 改造:Promise.all 并行获取今日猫 + 全品种
│   └── cats/
│       └── [id]/
│           └── page.tsx         # 详情页(RSC:getCat(id),404 → notFound())
├── components/
│   ├── home/
│   │   └── cat-gallery.tsx      # 首页品种画廊(服务端组件)
│   └── cats/
│       ├── cat-detail.tsx       # 详情页主体(服务端组件,接收 CatBreed 渲染)
│       └── radar-chart.tsx      # 自绘 SVG 雷达图("use client",入场动画)
└── lib/api.ts                   # 扩展:getCats() / getCat(id)
```

## 首页改造(`app/page.tsx`)

```tsx
export default async function Home() {
  const [dailyCat, cats] = await Promise.all([getDailyCat(), getCats()]);
  return (
    <>
      <HeroSection cat={dailyCat.breed} />
      <QuickLinksSection />
      <CatGallery cats={cats} />
      <DailyCatWidget initialData={dailyCat} />
    </>
  );
}
```

- `Promise.all` 并行获取,消除串行等待
- `app/loading.tsx` 骨架屏扩展画廊占位

## API 层扩展(`lib/api.ts`)

```ts
getCats(): Promise<CatBreed[]>        // GET /api/cats,cache: "no-store"
getCat(id: string): Promise<CatBreed> // GET /api/cats/{id};404 抛错由页面转 notFound
```

## 品种画廊(`components/home/cat-gallery.tsx`,服务端组件)

- 标题区:"猫咪百科" + 副标题(品种数动态:`{cats.length} 个品种,总有一款适合你`)
- 响应式网格:sm 2 列 / md 3 列 / lg 4 列;卡片 = `next/image`(图)+ 中文名 + 英文名
- 整卡 `Link` → `/cats/{id}`;`group-hover` 上浮微交互(与快捷直达卡一致)
- 画廊图与详情页共享浏览器缓存(next/image 同 URL)

## 今日猫联动(`daily-cat-widget.tsx` 微改)

- 图片区包 `Link` → `/cats/{data.breed.id}`(整卡可点)
- 增加"查看详情"按钮(与"换一只"并排,移动端点击目标大)

## 详情页(`app/cats/[id]/page.tsx` + `components/cats/cat-detail.tsx`)

```
← 返回首页(顶部小链接)
┌──────────┐  名(中/英)+ 语录
│   大图    │  网梗标签 pills(碰瓷专家/布偶摊…)
└──────────┘  基本信息:🌍 起源地 · 📏 体型 · 🐾 毛发
             适养人群徽章(久坐打工人/佛系老年人…)
             全方位雷达图(自绘 SVG)
```

- 内容映射 PRD:3.2.1 词条 + 3.2.2 雷达图 + 3.2.3 适养人群徽章
- 标签/徽章:`rounded-full` pill,奶油马卡龙配色延续
- `params` 在 Next.js 16 为 Promise(`await params` 后取 id);不存在 → `notFound()`

## 雷达图(`components/cats/radar-chart.tsx`,"use client")

- 输入 `scores: CatScores`(五维 1-10)→ 纯函数式输出 SVG
- 结构:五边形网格(满分线 + 基准 5 分线)+ 数据多边形 + 顶点标签
- 中文标签:拆家/粘人/掉毛/掉钱包/颜值
- 响应式:`viewBox` + `w-full`;入场动画用 `motion`(已装,stroke 或 scale)
- 颜色:设计令牌映射的 oklch 奶油马卡龙色板

## 错误处理

| 场景 | 处理 |
| --- | --- |
| 首页数据获取失败 | 根 `app/error.tsx`(已存在) |
| 详情页品种不存在 | `notFound()` → not-found 页面(友好"没有这只猫") |
| 详情页数据获取失败 | 根 `app/error.tsx` 作用于嵌套段 |
| 画廊/详情图片加载失败 | 图片容器带背景色占位 |

## 验证方式

| 步骤 | 验证 |
| --- | --- |
| 1. 类型 + lint | `bunx tsc --noEmit` + `bun lint` 零错误 |
| 2. 生产构建 | `bun run build` 通过,`/cats/[id]` 动态路由 |
| 3. 首页联动 | 后端启动 + `bun dev`:画廊 11 张卡;点卡片/今日猫 → 详情页;返回可用 |
| 4. 详情内容 | 抽查 3 个品种:标签/基本信息/适养人群/雷达图数值与 API 一致 |
| 5. 雷达图 | 网格 + 数据多边形渲染正确,动画正常 |
| 6. 404 | `/cats/ghost` → not-found 页 |
| 7. 响应式 | 移动端:画廊 2 列、详情单列正常 |
