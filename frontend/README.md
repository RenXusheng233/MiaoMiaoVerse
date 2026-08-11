# MiaoMiaoVerse Frontend

面向猫奴的 AI 全栈娱乐平台 Web 前端:猫咪百科、AI 文案、表情包生成、疗愈问答。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 框架 | Next.js 16.2(App Router,RSC 开启)· React 19 |
| 语言 | TypeScript 5(strict) |
| 样式 | Tailwind CSS v4(CSS-first,无 tailwind.config.*) |
| 组件 | shadcn/ui(`base-nova` 风格)· `@base-ui/react`(headless)· lucide-react 图标 |
| 动画 | motion(入场动画) |
| 包管理 | **bun**(绝不 npm/yarn) |

## 快速开始

```bash
bun install        # 安装依赖(bun.lock)
bun dev            # 开发服务器 → http://localhost:3000
```

### 依赖的后端服务

前端数据来自后端 API(`http://localhost:8000`),启动前需:

```bash
# backend 目录下
source .venv/bin/activate
uvicorn main:app --reload
```

### 环境变量

创建 `frontend/.env.local`(gitignored,不提交):

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

缺失该变量时应用启动即报错(尽早失败)。

## 页面路由

| 路由 | 内容 | 状态 |
| --- | --- | --- |
| `/` | 首页:视差 Hero + 快捷直达 + 猫咪百科画廊 + 今日明星猫 | ✅ |
| `/cats/[id]` | 猫咪详情:大图/语录/网梗标签/基本信息/适养人群徽章/雷达图 | ✅ |
| `/copywriting` | 文案生成:表单 + 三版并行 SSE 流式渲染 + 重生成 + 复制 | ✅ |
| `/meme` | 表情包生成 | 待开发(后端已就绪) |
| `/chat` | AI 疗愈问答 | 待开发(后端已就绪) |
| `/cats` | 品种列表页(带筛选) | 规划中(当前首页画廊已覆盖) |

## 常用命令

```bash
bun dev             # 开发服务器
bun run build       # 生产构建(next build)
bun run start       # 生产模式运行
bun lint            # ESLint
bunx tsc --noEmit   # 类型检查
bunx shadcn add <component>   # 添加 shadcn 组件
```

## 项目结构

```
frontend/
├── app/
│   ├── page.tsx              # 首页(RSC:并行获取今日猫 + 全品种)
│   ├── error.tsx             # 全局错误边界(unstable_retry 重试)
│   ├── loading.tsx           # 首页骨架屏
│   ├── layout.tsx            # 根布局(Geist + ZCOOL KuaiLe 字体)
│   ├── cats/[id]/            # 猫咪详情页 + not-found
│   ├── copywriting/          # 文案生成页 + loading
│   └── globals.css           # 全部设计令牌(oklch)
├── components/
│   ├── ui/                   # shadcn 生成组件(button/card/input/select/combobox…)
│   ├── home/                 # hero / quick-links / cat-gallery / daily-cat-widget
│   ├── cats/                 # cat-detail / radar-chart(自绘 SVG)
│   └── copywriting/          # copy-form / copy-card / copy-workspace
├── lib/
│   ├── api.ts                # 全部后端 API 封装(no-store)
│   ├── sse.ts                # 手写 fetch 流式 SSE 解析器
│   ├── utils.ts              # cn() 类合并
│   └── types/                # 与后端对齐的类型定义
└── docs/superpowers/         # 各模块设计文档(specs)与实现计划(plans)
```

## 关键约定

- **类合并一律 `cn()`**(`@/lib/utils`),不字符串拼接
- **设计令牌**:所有颜色/圆角/字体来自 `app/globals.css` 的 `@theme inline`(oklch),不硬编码色值;新颜色先加令牌再引用
- **数据获取**:API 封装统一 `cache: "no-store"`(本项目数据实时变化,不做缓存);RSC 页面服务端获取数据,客户端组件只做交互
- **图片域名**:外部图源需在 `next.config.ts` 的 `remotePatterns` 配置(`cdn2.thecatapi.com` 已配);`next/image` 的 `fill` 要求**直接父元素**为 `relative/absolute/fixed`
- **SSE**:EventSource 不支持 POST,统一用 `lib/sse.ts` 的 `streamSSE`(手写解析,chat 页面复用)
- **样式约定**:奶油马卡龙配色、`font-heading`(ZCOOL KuaiLe)标题、`rounded-3xl/4xl` 大圆角

## 文档索引

各模块设计与实现记录见 `docs/superpowers/specs/` 与 `docs/superpowers/plans/`,按模块命名(如 `2026-08-10-copywriting-frontend-design.md`)。
