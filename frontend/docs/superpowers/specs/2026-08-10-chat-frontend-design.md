# 疗愈问答前端(PRD 3.5)设计文档

> 前端实现 3.5 AI 疗愈问答页面:聊天式消息列表 + SSE 流式回答 + 医疗免责声明展示。

## 背景

- 后端 3.5 API 已就绪:`POST /api/chat`(SSE 流,双路由:闲聊 / 医疗 RAG,后端自动分类)
- 后端协议:事件 `chunk {content}` / `done {}` / `error {message}` / `disclaimer {text}`(仅医疗路由)
- **可复用**:`lib/sse.ts`(streamSSE 解析器,协议同款零改动)、copy-workspace 的编排经验(abort/竞态/error 守卫)、shadcn 组件(textarea 等)
- 首页快捷直达已跳 `/chat`(当前 404,本次实现)

## 核心决策

| 决策 | 选择 |
| --- | --- |
| 页面形态 | **聊天式消息列表**(用户/AI 气泡),多轮展示;后端单轮无状态 |
| SSE | 复用 `streamSSE`(零改动);编排沿用 copy-workspace 经验(abortRef + error 守卫) |
| 免责声明 | **跟随回答**:该 AI 消息气泡下方小字警示色(PRD 合规"必须展示") |
| 空状态 | 3 个示例问题卡片(护理/营养/疾病),点击即发送 |
| 会话持久化 | **不做**(后端无状态;刷新即清空;多轮记忆是非目标,见下) |
| 输入 | textarea + 发送按钮,流式进行中禁用 |

## 非目标(记录)

- **多轮记忆/上下文窗口管理不做**:后端单轮无状态,每轮只发送当前问题,历史不发给模型——上下文长度恒定,无需优化。未来若做多轮记忆(滑动窗口/会话持久化),再另行设计。

## 文件结构

```
frontend/
├── app/chat/
│   ├── page.tsx               # 页面壳(服务端,chat 无需 RSC 数据,直接渲染客户端组件)
│   └── loading.tsx            # 骨架占位
├── components/chat/
│   ├── chat-workspace.tsx     # 编排("use client"):消息列表 + SSE 流 + 输入区
│   ├── chat-message.tsx       # 单条消息(用户/AI 气泡 + 免责声明)
│   └── chat-input.tsx         # 输入区(textarea + 发送按钮)
└── lib/api.ts                 # 扩展:ChatMessage + sendChatMessage(复用 streamSSE)
```

## API 扩展(`lib/api.ts`)

```ts
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  disclaimer?: string;   // 医疗路由的免责声明文本
}

export function sendChatMessage(
  message: string,
  onEvent: (evt: SSEEvent) => void,
  signal: AbortSignal,
): Promise<void>
```

- `POST /api/chat`,body `{ message }`;事件处理在编排层

## 工作区编排(`chat-workspace.tsx`)

```
state: messages: ChatMessage[]、input: string、isStreaming: bool、
       error: string | null、abortRef
```

- **发送**:追加用户消息 + 空 AI 消息(光标动画)→ chunk 累积到该 AI 消息 → disclaimer 附加到该消息 → done 完成
- **竞态防护**:发送前 abort 进行中流;卸载 abort;error 事件 → 全局提示 + 该消息标记失败(不误标完成)
- **输入**:发送后清空;流式中禁用

## 聊天 UI

```
┌───────────────────────────────────────┐
│ ← 返回首页                             │
│  🐱 疗愈问答助手                       │
│  ┌─────────────────────────────┐      │
│  │ 空状态:示例问题卡片 × 3      │      │
│  └─────────────────────────────┘      │
│  [用户气泡]  你好,我家猫呕吐…          │
│  [AI 气泡]   猫咪呕吐常见原因…          │
│  ⚠️ 以上内容由 AI 生成…就医。          │  ← 免责声明(跟随该回答)
│  [输入区] textarea + 发送按钮          │
└───────────────────────────────────────┘
```

- 气泡:用户右对齐(主色)、AI 左对齐(卡片色);AI 流式中光标动画
- 免责声明:消息下方小字警示色
- 示例问题:护理「猫砂盆多久清理一次」/ 营养「换粮怎么过渡」/ 疾病「猫瘟早期有什么症状」

## 错误处理

| 场景 | 处理 |
| --- | --- |
| 输入为空 | 发送按钮禁用 |
| 流内 error 事件 | 该消息标记"回答失败" + 全局提示(不误标完成) |
| 连接失败 / 非 2xx | 全局错误条 + 消息标记失败 |
| 发送中再发送 | 输入区与按钮禁用 |
| 组件卸载 | AbortSignal 中止流 |

## 验证方式

| 步骤 | 验证 |
| --- | --- |
| 1. 静态 | tsc + lint + build 零错误 |
| 2. Playwright 闲聊 | "今天好累啊" → AI 流式回答,无免责声明 |
| 3. 医疗流 | "猫咪呕吐带血怎么办" → 回答 + 免责声明跟随显示 |
| 4. 多轮 | 连续两问 → 消息累积,第二轮正常流式 |
| 5. 示例问题 | 空状态点击 → 直接发送并流式 |
| 6. 发送中禁用 | 流式进行中输入/按钮禁用 |
| 7. 错误路径 | 停后端 → 发送 → 错误条 + 消息标记失败;恢复正常 |
| 8. 响应式 | 390px:气泡自适应,输入区正常 |
| 9. console | 无错误 |
