# 表情包工作室前端(PRD 3.6)设计文档

> 新增模块：低代码画布式表情包编辑器：与 3.4(多模态自动生成)并存：后端接口与前端入口均保留：3.4 待多模态模型选定后可继续使用。

## 背景

- **3.4 现状**：后端已实现 `POST /api/meme/overlay`(规则引擎占位 + Provider 抽象)：前端未实现：多模态模型待选型
- **3.6 定位**：用户手动设计的低代码画布编辑器：左侧组件面板，中间画布，右侧属性面板：导出 PNG 表情包
- **首页入口调整**：快捷直达卡"一键生成猫咪表情包"跳转 `/meme-studio`(原 `/meme` 路由保留备用)
- 技术：Fabric.js(画布对象模型)：Schema 驱动，前后端解耦，纯前端模块

## 核心决策

| 决策 | 选择 |
| --- | --- |
| 画布引擎 | Fabric.js(拖拽/缩放/旋转/控制框内置) |
| 数据模型 | Schema 驱动：Schema 是唯一数据源(画布/面板/导出全由它驱动) |
| 同步层 | FabricBridge：Fabric ↔ Schema 双向同步集中于此：可独立测试 |
| 组件集 | 文本 + 气泡(3 预设)+ emoji 贴纸 + 基础形状(圆/心/星) |
| 画布背景 | 纯色 / 线性渐变 / 上传图片 三种模式 |
| 尺寸预设 | square 1080×1080 / portrait 1080×1440 / wide 1080×608 / custom |
| 导出 | Fabric toDataURL：原始尺寸：按画布圆角裁剪 |
| AI 文案 | **不做**(用户决策：避免与 3.3 耦合) |
| 后端 | 3.4 接口不动：3.6 纯前端 |

## 文件结构

```
frontend/
├── app/meme-studio/
│   ├── page.tsx               # 页面壳(客户端组件：编辑器需浏览器 API)
│   └── loading.tsx            # 骨架
├── components/meme-studio/
│   ├── studio-workspace.tsx   # 编排：三栏布局 + 选中/全局态
│   ├── component-palette.tsx  # 左侧：组件面板
│   ├── canvas-stage.tsx       # 中间：Fabric 画布挂载
│   └── property-panel.tsx     # 右侧：全局配置/组件配置
├── lib/meme-studio/
│   ├── schema.ts              # Schema 类型(CanvasObject/CanvasConfig/MemeSchema)
│   ├── fabric-bridge.ts       # 双向同步核心
│   ├── presets.ts             # 气泡预设/emoji 集/形状定义
│   └── canvas-size.ts         # 尺寸预设
└── docs/                      # 本设计文档
```

## Schema 模型(`lib/meme-studio/schema.ts`)

```ts
export type CanvasObjectType = "text" | "bubble" | "emoji" | "shape";

export interface BaseObject {
  id: string;
  type: CanvasObjectType;
  left: number; top: number;
  scaleX: number; scaleY: number;
  angle: number; opacity: number;
}

export interface TextObject extends BaseObject {
  type: "text";
  text: string; fontSize: number;
  fill: string; stroke: string; strokeWidth: number;
  backgroundColor: string | null; cornerRadius: number;
}

export interface BubbleObject extends BaseObject {
  type: "bubble";
  preset: BubblePresetId;
  text: string; fontSize: number;
  fill: string; cornerRadius: number;
}

export interface EmojiObject extends BaseObject {
  type: "emoji";
  emoji: string; fontSize: number;
}

export interface ShapeObject extends BaseObject {
  type: "shape";
  shape: "circle" | "heart" | "star";
  fill: string; stroke: string; strokeWidth: number;
}

export interface CanvasConfig {
  width: number; height: number;
  backgroundMode: "color" | "gradient" | "image";
  backgroundColor: string;
  gradient: { from: string; to: string } | null;
  backgroundImage: string | null;   // dataURL
  cornerRadius: number;
}

export interface MemeSchema {
  canvas: CanvasConfig;
  objects: CanvasObject[];
}
```

## FabricBridge(`lib/meme-studio/fabric-bridge.ts`)

```ts
export class FabricBridge {
  constructor(canvas: fabric.Canvas, onChange: (schema: MemeSchema) => void)
  loadSchema(schema: MemeSchema): void
  addObject(obj: CanvasObject): string          // 返回 id 并选中
  updateObject(id: string, patch: Partial<CanvasObject>): void
  removeObject(id: string): void
  setCanvasConfig(patch: Partial<CanvasConfig>): void
  selectObject(id: string | null): void
  toDataURL(): string                           // 导出(原始尺寸 + 圆角裁剪)
}
```

- **画布 → Schema**：Fabric 事件(object:modified/moving/scaling/rotating/selected/cleared)→ 回写 Schema → onChange 通知 React
- **Schema → 画布**：updateObject/addObject/removeObject → 更新 Fabric 对象 → renderAll()
- **对象关联**：Fabric 对象挂 `customId` 映射 Schema id
- **背景**：backgroundColor / LinearGradient / setBackgroundImage
- **圆角导出**：clipPath(圆角矩形)裁剪，预览与导出一致

## 三栏 UI

### 左侧组件面板(`component-palette.tsx`)

- 文本："添加文本"项
- 气泡：3 种预设缩略图
- emoji：猫系贴纸网格(😂🐱✨💥❤️ 等 12-16 个)
- 形状：圆/心/星缩略图

### 中间画布(`canvas-stage.tsx`)

- Fabric canvas 挂载：初始化 bridge
- 视口缩放适配(内部 1080 基准：zoomToPoint 适配视口：导出用原始尺寸)
- 白边点击 → 取消选中 → 回退全局配置

### 右侧属性面板(`property-panel.tsx`)

- **全局配置**(未选中)：背景色/渐变(from/to)/上传背景图/画布圆角 slider/尺寸预设选择器
- **组件配置**(选中)：按类型：文本(文字/字号/颜色/描边/底色)、气泡(文字/字号/填充/圆角)、emoji(字号)、形状(填充/描边/描边宽)
- 修改 → bridge.updateObject → 画布实时刷新

## 首页入口调整

- `components/home/quick-links-section.tsx`：快捷直达卡 href `/meme` → `/meme-studio`
- 卡片标题/描述微调为"表情包工作室"：强调手动创作

## 错误处理

| 场景 | 处理 |
| --- | --- |
| 上传背景图失败(格式/超限) | 提示 + 保持原背景 |
| Fabric 初始化失败 | 页面级错误 + 重试(复用 error.tsx 模式) |
| 导出失败 | 提示"导出失败，请重试" |
| 自定义尺寸非法 | 校验提示：阻止应用 |
| 空画布 | 提示"从左侧添加组件开始创作" |

## 验证方式

| 步骤 | 验证 |
| --- | --- |
| 1. 静态 | tsc + lint + build 零错误 |
| 2. 三栏布局 | 进入 /meme-studio：组件面板/画布/全局配置面板齐全 |
| 3. 添加组件 | 四类组件均可添加：自动选中：右侧切组件配置 |
| 4. 双向联动 | 面板改属性 → 画布实时变：画布拖拽 → 面板数值同步 |
| 5. 选中切换 | 单选高亮：白边回退全局配置 |
| 6. 背景三模式 | 纯色/渐变/上传图均即时生效 |
| 7. 尺寸预设 | 4 预设 + 自定义，组件等比保留 |
| 8. 导出 | PNG 下载，尺寸一致，圆角生效，无控制框残留 |
| 9. 首页入口 | 快捷直达卡跳 /meme-studio |
| 10. 响应式 | 390px：三栏改上下布局 |

## PRD 更新(整体确认后执行)

- 新增 3.6 模块章节(定位：功能描述：技术要点)
- 实现进度总览更新：3.6 加入
- 首页快捷直达卡描述同步(跳转目标与定位)
