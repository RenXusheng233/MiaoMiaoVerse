# 首页前端(PRD 3.1)实现记录

> 回顾式文档：该模块由其他模型完成开发：本文件记录实际实现步骤与验证结果(非前瞻计划)。

**Goal：** 实现 PRD 3.1 首页(视差 Hero + 快捷直达 + 今日明星猫)。

**Architecture：** Next.js 16 App Router：RSC 服务端获取数据：客户端组件仅承载交互(今日猫 reroll)。

## 实现步骤回顾

| 步骤 | 内容 | 文件 |
| --- | --- | --- |
| 1 | 项目脚手架：shadcn 初始化(base-nova 风格) | `components.json`，`components/ui/` |
| 2 | 根布局 + 字体(Geist + ZCOOL KuaiLe)+ 设计令牌 | `app/layout.tsx`，`app/globals.css` |
| 3 | 类型与 API 封装(getDailyCat / getRandomCat) | `lib/types/cat.ts`，`lib/api.ts` |
| 4 | 视差 Hero(motion 滚动联动) | `components/home/hero-section.tsx` |
| 5 | 快捷直达魔方(3 张渐变卡片) | `components/home/quick-links-section.tsx` |
| 6 | 今日明星猫(换一只 + 预加载) | `components/home/daily-cat-widget.tsx` |
| 7 | 首页组装(RSC) | `app/page.tsx` |
| 8 | 错误边界 + 骨架屏(后期补充) | `app/error.tsx`，`app/loading.tsx` |

## 关键决策记录

- **no-store 数据获取**：每日猫与随机接口都要求实时：不做缓存(缓存会导致零点后仍显示昨日猫)
- **图片域名白名单**：next/image 默认拒绝外部域名：`remotePatterns` 必须维护：品种图源更换时同步更新
- **RSC/客户端边界**：静态展示走服务端组件：仅 reroll 交互为客户端组件：首屏最快

## 验证结果

| 场景 | 结果 |
| --- | --- |
| 首页三区块渲染 | ✅ |
| 换一只：排除当前品种：图片与文案同步切换 | ✅ |
| 图片域名加载 | ✅(TheCatAPI) |
| 移动端适配 | ✅ |
| 停后端错误兜底 | ✅(error.tsx) |
