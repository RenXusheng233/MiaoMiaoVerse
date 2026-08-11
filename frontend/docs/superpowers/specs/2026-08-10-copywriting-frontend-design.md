# 文案生成前端(PRD 3.3)设计文档

> 前端实现 3.3 文案生成页面:表单 + 三版并行 SSE 流式渲染 + 单版重新生成 + 一键复制。

## 背景

- 后端 3.3 API 已就绪:`POST /api/copy/generate`(三版并行 SSE)、`POST /api/copy/regenerate`(单版 SSE)
- 后端协议:请求 `CopyRequest`(`cat_name` 必填 / `breed` / `behavior` / `style_pref` 可选 / `platform` 默认 moments);SSE 事件 `chunk {style, content}` / `done {style}` / `error {message}`;三风格 `funny 搞笑 / healing 治愈 / cool 高冷`
- 前端现状:首页快捷直达已跳 `/copywriting`(当前 404,本次实现);UI 组件只有 button/card
- 品种数据:后端 11 个品种(`GET /api/cats`)

## 核心决策

| 决策 | 选择 |
| --- | --- |
| SSE 客户端 | **手写解析器**(`fetch` + `ReadableStream` 解析 `event:`/`data:` 帧)— EventSource 不支持 POST,第三方库已停止维护 |
| 表单控件 | shadcn 标准组件(`bunx shadcn add input select textarea label combobox`) |
| 品种字段 | **可搜索 combobox**,数据源 `getCats()`(11 种),允许"不填"(后端 breed 可选) |
| 行为/风格偏好 | 输入框 + **常见选项 chips** 快捷填入(点击填入,可自由编辑) |
| 复制反馈 | 按钮内联状态("已复制 ✓" 2 秒恢复),不引入 toast |
| 布局 | 桌面三卡横排、移动端堆叠;生成中三卡并行各自流式渲染 |

## 文件结构

```
frontend/
├── app/copywriting/
│   ├── page.tsx               # 页面容器(服务端,渲染客户端工作区)
│   └── loading.tsx            # 骨架占位
├── components/copywriting/
│   ├── copy-workspace.tsx     # 编排("use client"):表单值 → generate → 三卡分发
│   ├── copy-form.tsx          # 表单(input/combobox/chips/select)
│   └── copy-card.tsx          # 单版卡片:流式文本 + 重新生成 + 一键复制
└── lib/
    ├── sse.ts                 # 手写 SSE 解析器(3.5 chat 可复用)
    └── api.ts                 # 扩展:generateCopyStream / regenerateCopyStream
```

## SSE 解析器(`lib/sse.ts`)

```ts
export interface SSEEvent {
  event: string;    // "chunk" | "done" | "error"
  data: unknown;    // JSON.parse 结果(失败则原文)
}

export async function streamSSE(
  url: string,
  options: RequestInit,
  onEvent: (evt: SSEEvent) => void,
  signal?: AbortSignal,
): Promise<void>
```

- `fetch` POST → `response.body.getReader()` → `TextDecoder` 增量解码
- 按 `\n\n` 空行分帧,解析 `event:` / `data:` 行;支持 `AbortSignal` 中止

## API 扩展(`lib/api.ts`)

```ts
export type Platform = "moments" | "weibo" | "xiaohongshu" | "douyin";
export type CopyStyle = "funny" | "healing" | "cool";

export interface CopyForm {
  cat_name: string;      // 必填
  breed?: string;
  behavior?: string;
  style_pref?: string;
  platform: Platform;
}

export function generateCopyStream(form: CopyForm, onEvent, signal): Promise<void>
export function regenerateCopyStream(form: CopyForm & { style: CopyStyle }, onEvent, signal): Promise<void>
```

## 工作区编排(`copy-workspace.tsx`)

```
state: form / lastForm(生成时快照)/ results{funny/healing/cool: text} /
       status(空闲/生成中/完成/错误)/ regeneratingStyle
```

- **生成**:点"生成文案" → 快照 `lastForm = form` → `generateCopyStream` → `chunk` 按 `style` 分发累积 → 三版 `done` → 状态"完成";`error` 事件 → 全局错误
- **单版重新生成**:每卡按钮 → `regenerateCopyStream(lastForm + style)` → 该卡清空重流(其他两卡不动)
- 生成中禁用提交;重新生成用 `lastForm` 快照(生成后改表单不影响已生成内容)

## 表单(`copy-form.tsx`)

```
猫咪名字 *  [ 输入框 ]
品种        [ 选择品种 ▾ ]        ← combobox:getCats() 11 种,可搜索,可不选
当前状态/行为 [ 输入框 ]
            (正在拆沙发 · 刚睡醒 · 粘人精附体 · 疯狂跑酷 · 求摸摸 · 犯错了装无辜)
风格偏好    [ 输入框 ]
            (带点反差萌 · 语气沙雕一点 · 治愈温柔一点 · 高冷傲娇 · 撒个娇)
平台目标    [ 朋友圈 ▾ ]          ← select:朋友圈/微博/小红书/抖音
```

- 校验:名字为空 → 提交禁用 + "给猫咪起个名字吧"
- chips:点击填入输入框(替换值,可再编辑);无选中态(输入框是唯一状态源)
- 布局:两列网格(sm+)

## 三版卡片(`copy-card.tsx`)

```
┌─────────────────────────────┐
│ 🎭 高冷版        [重新生成]  │
│ 流式渲染的文案文本(光标动画)  │
│               [一键复制]    │
└─────────────────────────────┘
```

| 交互 | 行为 |
| --- | --- |
| 流式渲染 | chunk 累积;生成中光标动画;done 后"完成" |
| 重新生成 | 该卡清空重流;其他卡不动 |
| 一键复制 | `navigator.clipboard` → 按钮变"已复制 ✓" 2 秒 |
| 空状态 | "等待生成…"占位 |

## 错误处理

| 场景 | 处理 |
| --- | --- |
| 名字为空 | 提交禁用 + 提示 |
| SSE 连接失败 / 非 2xx | 全局错误条 |
| 流内 error 事件 | 对应卡失败状态 + 全局提示(其他完成卡保留) |
| 重新生成失败 | 该卡"重新生成失败",旧文本保留 |
| 组件卸载 | AbortSignal 中止流 |
| 复制失败 | 按钮短暂"复制失败" |

## 验证方式

| 步骤 | 验证 |
| --- | --- |
| 1. 组件安装 | shadcn add 后构建通过 |
| 2. 静态 | tsc + lint + build 零错误 |
| 3. Playwright 生成 | 填名字 → 生成 → 三卡同时流式渲染 |
| 4. 三版内容 | 每卡非空且风格不同 |
| 5. combobox | 搜索"布" → 布偶猫;可不选 |
| 6. chips | 点"正在拆沙发"填入,可编辑 |
| 7. 重新生成 | 仅目标卡重流 |
| 8. 复制 | 按钮反馈 + 粘贴验证 |
| 9. 错误路径 | 停后端 → 全局错误条 |
| 10. 响应式 | 390px:表单/三卡单列 |
