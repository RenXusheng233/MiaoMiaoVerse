# 首页前端(PRD 3.1)实现文档

> 回顾式文档：记录已实现功能(该模块由其他模型完成开发：本文件补记设计决策与现状)。

## 背景

PRD 3.1 首页：第一印象页，快速传达平台调性并引导用户进入核心功能。

- **3.1.1 视差 Hero Section**：滚动时猫咪插画随视差效果动态浮现 + Slogan + CTA
- **3.1.2 快捷直达魔方**：三张功能卡片直通 AI 疗愈问答 / 表情包 / 文案神器
- **3.1.3 今日明星猫咪(Daily Cat)**：每日推荐一个品种，支持换一只

## 实现概览

```
frontend/
├── app/
│   ├── page.tsx              # 首页(RSC：获取今日猫数据并渲染三区块)
│   ├── layout.tsx            # 根布局(Geist + ZCOOL KuaiLe 字体，zh-CN)
│   ├── globals.css           # 设计令牌(@theme inline，oklch 奶油马卡龙色板)
│   ├── error.tsx             # 全局错误边界(unstable_retry 重试)
│   └── loading.tsx           # 首页骨架屏(hero + 画廊 + 今日猫占位)
├── components/
│   ├── home/
│   │   ├── hero-section.tsx        # 视差 Hero(motion 滚动联动)
│   │   ├── quick-links-section.tsx # 快捷直达魔方(3 张渐变卡片)
│   │   └── daily-cat-widget.tsx    # 今日明星猫(换一只 + 图片预加载)
│   └── ui/                          # shadcn 生成(button / card)
├── lib/
│   ├── api.ts                # getDailyCat / getRandomCat(no-store)
│   ├── types/cat.ts          # CatBreed / CatScores / DailyCatResponse
│   └── utils.ts              # cn() 类合并
└── next.config.ts            # 图片域名配置(remotePatterns)
```

## 页面结构

```
首页(服务端组件)
├── HeroSection          # 90vh 视差区(motion 库)：滚动时云朵/爪印/猫图分层位移淡出
├── QuickLinksSection    # 三张卡片：oklch 渐变，hover 上浮微交互
└── DailyCatWidget       # 客户端组件：今日猫大图 + 语录 + 换一只 + 查看详情
```

- 页面为 RSC：数据获取走服务端(`cache: no-store`：每日刷新语义)
- 今日猫区块为客户端组件：管理 reroll 状态与图片预加载

## 核心设计决策

| 决策 | 选择 |
| --- | --- |
| 数据获取 | RSC 服务端 fetch `getDailyCat()`：`no-store` 保证每日零点换猫即时生效 |
| 图片 | `next/image` + `remotePatterns`(cdn2.thecatapi.com)：每日猫 `priority` 预加载 |
| 换一只 | 客户端调 `getRandomCat(exclude_id)`：排除当前品种：失败保留旧数据并提示 |
| 图片预加载 | reroll 后先 `new window.Image()` 预加载新图，就绪才切换文案+图片(8 秒超时兜底) |
| 字体 | Geist(正文)+ ZCOOL KuaiLe(`font-heading` 标题：快乐体符合治愈调性) |
| 设计令牌 | 全部颜色/圆角在 globals.css `@theme inline`(oklch)：组件不硬编码色值 |
| 错误/加载 | `error.tsx`(unstable_retry 重试)+ `loading.tsx`(骨架屏) |
| 无障碍 | 装饰元素 `aria-hidden`：图片带 `alt`：CTA 用 `buttonVariants` 链接 |

## 关键实现细节

- **每日确定性**：后端按日期种子选择：同日访问结果一致：前端无需缓存(no-store 直取)
- **换一只交互**：`disabled` 防连点：图片预加载完成才 `setData`：避免文案已换图仍空白
- **命名陷阱**：组件内 `Image` 被 next/image 遮蔽：预加载用 `window.Image` 显式取 DOM 构造函数
- **图片域名**：外部图源必须先配 `remotePatterns`：否则 next/image 拒绝加载

## 后期演进记录(非 3.1 初版)

- 3.2 联动：首页新增猫咪百科画廊(CatGallery)：今日猫可点击进详情
- 3.3/3.5 期间：补充 error.tsx / loading.tsx / 图片预加载优化
- 品种图源，由 Wikimedia 不可达，更换为 TheCatAPI 品种图

## 验证方式(开发期)

| 场景 | 验证 |
| --- | --- |
| 首页渲染 | 三区块完整，字体/令牌生效 |
| 今日猫确定性 | 同日多次访问同品种：换一只后品种变化且排除当前 |
| 图片加载 | TheCatAPI 图正常显示：预加载后切换无空白 |
| 响应式 | 移动端单列：Hero 高度自适应 |
| 错误兜底 | 停后端，首页显示错误页而非 500 |
