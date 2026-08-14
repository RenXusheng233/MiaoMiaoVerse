# 表情包工作室前端实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 PRD 3.6 表情包工作室:三栏低代码画布编辑器(Fabric.js + Schema 驱动),导出 PNG,更新首页入口与 PRD。

**Architecture:** Schema 是唯一数据源;`FabricBridge` 集中处理 Fabric ↔ Schema 双向同步(对象映射为纯函数可独立测试);三栏 UI(组件面板/画布/属性面板)由 workspace 编排;导出用原始尺寸 + 圆角裁剪。

**Tech Stack:** Next.js 16.2 · TypeScript 5 · Tailwind v4 · shadcn/ui · **fabric.js**(新增依赖)· Playwright

**Spec:** `frontend/docs/superpowers/specs/2026-08-11-meme-studio-design.md`

## Global Constraints

- 全部代码在 `frontend/` 下;命令从 `frontend/` 运行;依赖管理用 **bun**(`bun add fabric`)
- 项目初期:实现者**不执行** `git add` / `git commit`(用户手动提交)
- 类合并用 `cn()`;设计令牌来自 globals.css;注释英文、用户文案中文(全角标点)
- 项目暂无测试框架:静态验证 `bunx tsc --noEmit` + `bun lint` + `bun run build`;端到端 Playwright
- Schema 是唯一数据源:画布渲染/属性面板/导出全部由 `MemeSchema` 驱动
- 3.4 后端接口不动;/meme 路由保留(入口改指 /meme-studio)
- Fabric 对象用 `customId` 关联 Schema id;所有同步逻辑在 `fabric-bridge.ts`
- 本模块无需后端运行即可开发(纯前端);Playwright 验证画布交互不依赖后端

---

### Task 1: 依赖 + Schema 模型 + 尺寸预设

**Files:**
- Create: `frontend/lib/meme-studio/schema.ts`、`frontend/lib/meme-studio/canvas-size.ts`

**Interfaces:**
- Produces: `CanvasObject`(联合类型)/ `CanvasConfig` / `MemeSchema` / `CanvasSizePreset` 与 `CANVAS_SIZE_PRESETS` — 供 Task 2-6 使用

- [ ] **Step 1: 安装 fabric**

Run: `cd /Users/renxusheng/Documents/AI/MiaoMiaoVerse/frontend && bun add fabric`
Expected: package.json 新增 fabric;`bun run build` 通过

- [ ] **Step 2: 创建 Schema 模型**

```ts
// frontend/lib/meme-studio/schema.ts
export type CanvasObjectType = "text" | "bubble" | "emoji" | "shape";
export type ShapeKind = "circle" | "heart" | "star";
export type BackgroundMode = "color" | "gradient" | "image";

export interface BaseObject {
  id: string;
  type: CanvasObjectType;
  left: number;
  top: number;
  scaleX: number;
  scaleY: number;
  angle: number;
  opacity: number;
}

export interface TextObject extends BaseObject {
  type: "text";
  text: string;
  fontSize: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  backgroundColor: string | null;
  cornerRadius: number;
}

export interface BubbleObject extends BaseObject {
  type: "bubble";
  preset: BubblePresetId;
  text: string;
  fontSize: number;
  fill: string;
  cornerRadius: number;
}

export interface EmojiObject extends BaseObject {
  type: "emoji";
  emoji: string;
  fontSize: number;
}

export interface ShapeObject extends BaseObject {
  type: "shape";
  shape: ShapeKind;
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export type CanvasObject = TextObject | BubbleObject | EmojiObject | ShapeObject;

export interface CanvasConfig {
  width: number;
  height: number;
  backgroundMode: BackgroundMode;
  backgroundColor: string;
  gradient: { from: string; to: string } | null;
  backgroundImage: string | null; // dataURL
  cornerRadius: number;
}

export interface MemeSchema {
  canvas: CanvasConfig;
  objects: CanvasObject[];
}
```

- [ ] **Step 3: 创建尺寸预设**

```ts
// frontend/lib/meme-studio/canvas-size.ts
export interface CanvasSizePreset {
  id: "square" | "portrait" | "wide" | "custom";
  label: string;
  width: number;
  height: number;
}

export const CANVAS_SIZE_PRESETS: CanvasSizePreset[] = [
  { id: "square", label: "方形(朋友圈)", width: 1080, height: 1080 },
  { id: "portrait", label: "竖图(小红书)", width: 1080, height: 1440 },
  { id: "wide", label: "宽幅(横幅)", width: 1080, height: 608 },
  { id: "custom", label: "自定义", width: 1080, height: 1080 },
];
```

- [ ] **Step 4: 类型 + lint**

Run: `bunx tsc --noEmit && bun lint`
Expected: 零错误

- [ ] **Step 5: 结束任务验证**

```bash
git status --short
```
Expected: 新增 lib/meme-studio/{schema,canvas-size}.ts,修改 package.json/bun.lock(不提交)

---

### Task 2: 组件预设 + Fabric 映射纯函数

**Files:**
- Create: `frontend/lib/meme-studio/presets.ts`
- Create: `frontend/lib/meme-studio/fabric-mapping.ts`

**Interfaces:**
- Consumes: Task 1 的 `CanvasObject` 类型
- Produces: `createDefaultObject(type)` / `BUBBLE_PRESETS` / `EMOJI_SET` / `createShapeObject(kind)`;`schemaToFabricProps(obj)` / `fabricPropsToSchema(obj, event)` — 供 Task 3/4 使用

> 注意(Task 1 审查协调项){CL}Task 1 为通过 tsc 在 schema.ts 加了前向声明 `export type BubblePresetId = string`{CL}本任务必须删除该声明{CL}union 只定义在本文件(下述代码){CL}BubbleObject 通过 import type 引用{CL}避免两处同名导出。

- [ ] **Step 1: 创建组件预设**

```ts
// frontend/lib/meme-studio/presets.ts
import type { CanvasObject, CanvasObjectType, ShapeKind, ShapeObject } from "./schema";

export type BubblePresetId = "default" | "speech" | "thought";

export type BubblePresetId = "default" | "speech" | "thought";

export const BUBBLE_PRESETS: Record<BubblePresetId, { label: string; fill: string; cornerRadius: number }> = {
  default: { label: "圆角气泡", fill: "#FFFFFF", cornerRadius: 24 },
  speech: { label: "对话气泡", fill: "#FFF7E6", cornerRadius: 32 },
  thought: { label: "气泡", fill: "#E8F4FD", cornerRadius: 16 },
};

export const EMOJI_SET = ["😂", "🐱", "✨", "💥", "❤️", "😾", "🍗", "💤", "🤔", "😻", "🙀", "👍"];

export function createShapeObject(kind: ShapeKind): ShapeObject {
  return {
    id: crypto.randomUUID(),
    type: "shape",
    shape: kind,
    left: 400,
    top: 300,
    scaleX: 1,
    scaleY: 1,
    angle: 0,
    opacity: 1,
    fill: "#FFD1DC",
    stroke: "#000000",
    strokeWidth: 0,
  };
}

export function createDefaultObject(type: CanvasObjectType): CanvasObject {
  const base = { id: crypto.randomUUID(), left: 400, top: 300, scaleX: 1, scaleY: 1, angle: 0, opacity: 1 };
  switch (type) {
    case "text":
      return { ...base, type, text: "双击编辑文字", fontSize: 64, fill: "#FFFFFF", stroke: "#000000", strokeWidth: 4, backgroundColor: null, cornerRadius: 0 };
    case "bubble":
      return { ...base, type, preset: "default", text: "喵呜~", fontSize: 48, fill: "#FFFFFF", cornerRadius: 24 };
    case "emoji":
      return { ...base, type, emoji: EMOJI_SET[0], fontSize: 120 };
    case "shape":
      return createShapeObject("circle");
  }
}
```

- [ ] **Step 2: 创建 Fabric 映射纯函数**

```ts
// frontend/lib/meme-studio/fabric-mapping.ts
import type { CanvasObject, ShapeKind } from "./schema";

/** Map a schema object to fabric.js constructor options (pure, testable). */
export function schemaToFabricOptions(obj: CanvasObject): Record<string, unknown> {
  const common = { left: obj.left, top: obj.top, scaleX: obj.scaleX, scaleY: obj.scaleY, angle: obj.angle, opacity: obj.opacity };
  switch (obj.type) {
    case "text":
      return { ...common, type: "text", text: obj.text, fontSize: obj.fontSize, fill: obj.fill, stroke: obj.stroke, strokeWidth: obj.strokeWidth, cornerRadius: obj.cornerRadius };
    case "bubble":
      return { ...common, type: "text", text: obj.text, fontSize: obj.fontSize, fill: obj.fill, cornerRadius: obj.cornerRadius };
    case "emoji":
      return { ...common, type: "text", text: obj.emoji, fontSize: obj.fontSize, fill: "#000000" };
    case "shape":
      return { ...common, type: obj.shape, fill: obj.fill, stroke: obj.stroke, strokeWidth: obj.strokeWidth };
  }
}

/** Extract schema-relevant props back from a fabric object (pure). */
export function fabricPropsToSchema(obj: { left: number; top: number; scaleX: number; scaleY: number; angle: number; opacity: number }): Pick<CanvasObject, "left" | "top" | "scaleX" | "scaleY" | "angle" | "opacity"> {
  return { left: obj.left, top: obj.top, scaleX: obj.scaleX, scaleY: obj.scaleY, angle: obj.angle, opacity: obj.opacity };
}

export const SHAPE_PATH: Record<ShapeKind, string> = {
  circle: "",          // fabric.Circle
  heart: "M 0 10 A 10 10 0 0 1 20 10 C 20 0 0 -10 0 -20 C 0 -10 -20 0 -20 10 A 10 10 0 0 1 0 10 Z",
  star: "M 0 -20 L 6 -6 L 20 -6 L 9 3 L 13 18 L 0 9 L -13 18 L -9 3 L -20 -6 L -6 -6 Z",
};
```

- [ ] **Step 3: 验证纯函数(bun 直跑 TS)**

写临时脚本 `/tmp/meme-map-test.ts`:

```ts
import { createDefaultObject } from "/Users/renxusheng/Documents/AI/MiaoMiaoVerse/frontend/lib/meme-studio/presets";
import { fabricPropsToSchema, schemaToFabricOptions } from "/Users/renxusheng/Documents/AI/MiaoMiaoVerse/frontend/lib/meme-studio/fabric-mapping";

const text = createDefaultObject("text");
const opts = schemaToFabricOptions(text);
if (opts.text !== "双击编辑文字" || opts.fontSize !== 64) throw new Error("text mapping failed");
const round = fabricPropsToSchema({ left: 1, top: 2, scaleX: 0.5, scaleY: 0.5, angle: 30, opacity: 0.8 });
if (round.angle !== 30 || round.opacity !== 0.8) throw new Error("roundtrip failed");
console.log("mapping OK");
```

Run: `bun /tmp/meme-map-test.ts`
Expected: 输出 `mapping OK`

- [ ] **Step 4: 类型 + lint**

Run: `bunx tsc --noEmit && bun lint`
Expected: 零错误

- [ ] **Step 5: 结束任务验证**

```bash
git status --short
```
Expected: 新增 presets.ts、fabric-mapping.ts(不提交)

---

### Task 3: FabricBridge(双向同步核心)

**Files:**
- Create: `frontend/lib/meme-studio/fabric-bridge.ts`

**Interfaces:**
- Consumes: Task 1 的 `MemeSchema` / `CanvasObject` / `CanvasConfig`;Task 2 的 `schemaToFabricOptions` / `fabricPropsToSchema` / `SHAPE_PATH`
- Produces: `FabricBridge`(loadSchema/addObject/updateObject/removeObject/setCanvasConfig/selectObject/toDataURL)— 供 Task 4/5 使用

- [ ] **Step 1: 创建 FabricBridge**

```ts
// frontend/lib/meme-studio/fabric-bridge.ts
import { fabric } from "fabric";
import type { CanvasConfig, CanvasObject, MemeSchema } from "./schema";
import { SHAPE_PATH, fabricPropsToSchema, schemaToFabricOptions } from "./fabric-mapping";

export class FabricBridge {
  private canvas: fabric.Canvas;
  private schema: MemeSchema;
  private onChange: (schema: MemeSchema) => void;

  constructor(canvas: fabric.Canvas, initial: MemeSchema, onChange: (schema: MemeSchema) => void) {
    this.canvas = canvas;
    this.schema = JSON.parse(JSON.stringify(initial));
    this.onChange = onChange;
    this.bindEvents();
    this.renderAll();
  }

  private bindEvents() {
    this.canvas.on("selection:created", () => this.emit());
    this.canvas.on("selection:cleared", () => this.emit());
    this.canvas.on("object:modified", (e) => this.syncFromFabric(e.target));
  }

  private syncFromFabric(target: fabric.Object | undefined) {
    if (!target) return;
    const id = target.get("customId") as string | undefined;
    if (!id) return;
    const obj = this.schema.objects.find((o) => o.id === id);
    if (!obj) return;
    Object.assign(obj, fabricPropsToSchema(target));
    if (target.type === "i-text" || target.type === "textbox") {
      const text = target as fabric.Textbox;
      obj.text = text.text ?? "";
    }
    this.emit();
  }

  private emit() {
    this.onChange(JSON.parse(JSON.stringify(this.schema)));
  }

  /** (Re)render the whole canvas from the current schema. */
  renderAll() {
    this.canvas.clear();
    this.applyCanvasConfig(this.schema.canvas);
    for (const obj of this.schema.objects) {
      this.canvas.add(this.createFabricObject(obj));
    }
    this.canvas.renderAll();
  }

  private applyCanvasConfig(cfg: CanvasConfig) {
    this.canvas.setDimensions({ width: cfg.width, height: cfg.height });
    if (cfg.backgroundMode === "image" && cfg.backgroundImage) {
      fabric.Image.fromURL(cfg.backgroundImage, (img) => {
        img.scaleToWidth(cfg.width);
        this.canvas.backgroundImage = img;
        this.canvas.renderAll();
      });
    } else if (cfg.backgroundMode === "gradient" && cfg.gradient) {
      const grad = new fabric.Gradient({
        type: "linear",
        coords: { x1: 0, y1: 0, x2: cfg.width, y2: cfg.height },
        colorStops: [{ offset: 0, color: cfg.gradient.from }, { offset: 1, color: cfg.gradient.to }],
      });
      this.canvas.backgroundColor = grad as unknown as string;
    } else {
      this.canvas.backgroundColor = cfg.backgroundColor;
    }
    this.canvas.renderAll();
  }

  private createFabricObject(obj: CanvasObject): fabric.Object {
    const options = schemaToFabricOptions(obj);
    let fobj: fabric.Object;
    if (obj.type === "shape" && obj.shape !== "circle") {
      fobj = new fabric.Path(SHAPE_PATH[obj.shape], options as fabric.IPathOptions);
    } else if (obj.type === "shape") {
      fobj = new fabric.Circle({ ...options, radius: 80 } as fabric.ICircleOptions);
    } else {
      fobj = new fabric.Textbox((obj as { text: string }).text ?? "", options as fabric.ITextboxOptions);
    }
    fobj.set({ customId: obj.id });
    if (obj.type === "text" && obj.backgroundColor) {
      fobj.set({ backgroundColor: obj.backgroundColor });
    }
    return fobj;
  }

  addObject(obj: CanvasObject): string {
    this.schema.objects.push(obj);
    const fobj = this.createFabricObject(obj);
    this.canvas.add(fobj);
    this.canvas.setActiveObject(fobj);
    this.emit();
    this.canvas.renderAll();
    return obj.id;
  }

  updateObject(id: string, patch: Partial<CanvasObject>): void {
    const idx = this.schema.objects.findIndex((o) => o.id === id);
    if (idx === -1) return;
    Object.assign(this.schema.objects[idx], patch);
    const fobj = this.canvas.getObjects().find((o) => o.get("customId") === id);
    if (fobj) {
      Object.assign(fobj, patch);
      fobj.set("fill", patch.fill ?? fobj.get("fill"));
      fobj.set("text", patch.text ?? fobj.get("text"));
      fobj.set("fontSize", patch.fontSize ?? fobj.get("fontSize"));
      this.canvas.renderAll();
    }
    this.emit();
  }

  removeObject(id: string): void {
    this.schema.objects = this.schema.objects.filter((o) => o.id !== id);
    const fobj = this.canvas.getObjects().find((o) => o.get("customId") === id);
    if (fobj) this.canvas.remove(fobj);
    this.emit();
    this.canvas.renderAll();
  }

  setCanvasConfig(patch: Partial<CanvasConfig>): void {
    Object.assign(this.schema.canvas, patch);
    this.applyCanvasConfig(this.schema.canvas);
    this.emit();
  }

  selectObject(id: string | null): void {
    if (!id) {
      this.canvas.discardActiveObject();
    } else {
      const fobj = this.canvas.getObjects().find((o) => o.get("customId") === id);
      if (fobj) this.canvas.setActiveObject(fobj);
    }
    this.canvas.renderAll();
    this.emit();
  }

  getSelectedId(): string | null {
    const active = this.canvas.getActiveObject();
    return active ? (active.get("customId") as string) ?? null : null;
  }

  toDataURL(): string {
    this.canvas.discardActiveObject();
    this.canvas.renderAll();
    return this.canvas.toDataURL({ format: "png", multiplier: 1 });
  }

  getSchema(): MemeSchema {
    return JSON.parse(JSON.stringify(this.schema));
  }
}
```

> 注:fabric v6 类型为 `fabric.Canvas` / `fabric.Textbox` 等(命名导出);若 fabric 类型与上面签名不符,按实际包类型适配并记录。`crypto.randomUUID()` 需浏览器环境(客户端组件中可用)。

> **Task 3 审查裁决(2026-08-11)**:emoji 是贴纸,禁止画布内直接编辑文本——(1) 创建 emoji 对象时设置 `editable: false`(防用户双击进入文本编辑态);(2) `syncFromFabric` 的文本回写按类型分支{CL}text/bubble 写 `obj.text`{CL}emoji 写 `obj.emoji`(防 schema 污染)。

- [ ] **Step 2: 类型 + lint**

Run: `bunx tsc --noEmit && bun lint`
Expected: 零错误(若 fabric 类型报错,按实际 API 调整)

- [ ] **Step 3: 结束任务验证**

```bash
git status --short
```
Expected: 新增 fabric-bridge.ts(不提交)

---

### Task 4: 画布组件 + 组件面板

**Files:**
- Create: `frontend/components/meme-studio/canvas-stage.tsx`
- Create: `frontend/components/meme-studio/component-palette.tsx`

**Interfaces:**
- Consumes: Task 3 的 `FabricBridge`;Task 2 的 `createDefaultObject` / `BUBBLE_PRESETS` / `EMOJI_SET` / `createShapeObject`;Task 1 的 `MemeSchema`
- Produces: `CanvasStage({ bridgeRef, schema, onSelectionChange })`(挂载 Fabric canvas 并初始化 bridge)、`ComponentPalette({ onAdd })` — 供 Task 5 使用

- [ ] **Step 1: 创建画布组件**

```tsx
// frontend/components/meme-studio/canvas-stage.tsx
"use client";

import { useEffect, useRef } from "react";
import { fabric } from "fabric";
import { FabricBridge } from "@/lib/meme-studio/fabric-bridge";
import type { MemeSchema } from "@/lib/meme-studio/schema";

interface CanvasStageProps {
  schema: MemeSchema;
  bridgeRef: React.MutableRefObject<FabricBridge | null>;
  onSchemaChange: (schema: MemeSchema) => void;
  onSelectionChange: (id: string | null) => void;
}

export function CanvasStage({ schema, bridgeRef, onSchemaChange, onSelectionChange }: CanvasStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current || !containerRef.current || !canvasRef.current) return;
    initializedRef.current = true;
    const canvas = new fabric.Canvas(canvasRef.current, { selection: true });
    const bridge = new FabricBridge(canvas, schema, (s) => {
      onSchemaChange(s);
      onSelectionChange(bridge.getSelectedId());
    });
    bridgeRef.current = bridge;
    // 白边点击取消选中
    canvas.on("mouse:down", (e) => {
      if (!e.target) {
        canvas.discardActiveObject();
        canvas.renderAll();
        onSelectionChange(null);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 画布尺寸或背景变化时重建(尺寸/背景来自属性面板)
  useEffect(() => {
    bridgeRef.current?.setCanvasConfig({ width: schema.canvas.width, height: schema.canvas.height });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema.canvas.width, schema.canvas.height]);

  return (
    <div ref={containerRef} className="flex flex-1 items-center justify-center overflow-auto bg-muted/40 p-6">
      <canvas ref={canvasRef} />
    </div>
  );
}
```

> 注:初始化仅一次(initializedRef 守卫);bridge 在 canvas-stage 首次挂载时创建,经 bridgeRef 暴露给 workspace 使用;尺寸变化走 setCanvasConfig。

- [ ] **Step 2: 创建组件面板**

```tsx
// frontend/components/meme-studio/component-palette.tsx
"use client";

import { BUBBLE_PRESETS, EMOJI_SET, createDefaultObject, createShapeObject, type BubblePresetId } from "@/lib/meme-studio/presets";
import type { CanvasObject, ShapeKind } from "@/lib/meme-studio/schema";

interface ComponentPaletteProps {
  onAdd: (obj: CanvasObject) => void;
}

export function ComponentPalette({ onAdd }: ComponentPaletteProps) {
  return (
    <aside className="w-56 shrink-0 space-y-4 overflow-y-auto border-r border-border p-4">
      <h2 className="font-heading text-lg text-foreground">组件</h2>

      <section>
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">文本</h3>
        <button
          type="button"
          onClick={() => onAdd(createDefaultObject("text"))}
          className="w-full rounded-xl border border-border px-4 py-3 text-left text-sm text-foreground transition-colors hover:border-primary hover:text-primary"
        >
          添加文本
        </button>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">气泡</h3>
        <div className="space-y-2">
          {(Object.keys(BUBBLE_PRESETS) as BubblePresetId[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onAdd(createDefaultObject("bubble"))}
              className="w-full rounded-xl border border-border px-4 py-3 text-left text-sm text-foreground transition-colors hover:border-primary hover:text-primary"
            >
              {BUBBLE_PRESETS[id].label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">emoji 贴纸</h3>
        <div className="grid grid-cols-4 gap-2">
          {EMOJI_SET.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onAdd({ ...createDefaultObject("emoji"), emoji })}
              className="flex h-11 items-center justify-center rounded-xl border border-border text-xl transition-colors hover:border-primary"
            >
              {emoji}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">形状</h3>
        <div className="grid grid-cols-3 gap-2">
          {(["circle", "heart", "star"] as ShapeKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => onAdd(createShapeObject(kind))}
              className="flex h-11 items-center justify-center rounded-xl border border-border text-lg transition-colors hover:border-primary"
            >
              {kind === "circle" ? "●" : kind === "heart" ? "♥" : "★"}
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}
```

- [ ] **Step 3: 类型 + lint**

Run: `bunx tsc --noEmit && bun lint`
Expected: 零错误

- [ ] **Step 4: 结束任务验证**

```bash
git status --short
```
Expected: 新增 components/meme-studio/{canvas-stage,component-palette}.tsx(不提交)

---

### Task 5: 属性面板 + 工作区 + 页面 + 导出 + 首页入口 + PRD

**Files:**
- Create: `frontend/components/meme-studio/property-panel.tsx`
- Create: `frontend/components/meme-studio/studio-workspace.tsx`
- Create: `frontend/app/meme-studio/page.tsx`、`frontend/app/meme-studio/loading.tsx`
- Modify: `frontend/components/home/quick-links-section.tsx`(/meme → /meme-studio)
- Modify: `PRD.md`(新增 3.6 章节 + 进度更新)

**Interfaces:**
- Consumes: Task 1-4 的全部;`CANVAS_SIZE_PRESETS`
- Produces: `/meme-studio` 页面(三栏编辑器 + 导出)

- [ ] **Step 1: 创建属性面板**

```tsx
// frontend/components/meme-studio/property-panel.tsx
"use client";

import { CANVAS_SIZE_PRESETS } from "@/lib/meme-studio/canvas-size";
import type { CanvasConfig, CanvasObject, MemeSchema } from "@/lib/meme-studio/schema";

interface PropertyPanelProps {
  schema: MemeSchema;
  selectedId: string | null;
  onCanvasChange: (patch: Partial<CanvasConfig>) => void;
  onObjectChange: (id: string, patch: Partial<CanvasObject>) => void;
}

const BASE_INPUT = "w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring";

export function PropertyPanel({ schema, selectedId, onCanvasChange, onObjectChange }: PropertyPanelProps) {
  const canvas = schema.canvas;
  const selected = selectedId ? schema.objects.find((o) => o.id === selectedId) : undefined;

  if (!selected) {
    return (
      <aside className="w-72 shrink-0 space-y-4 overflow-y-auto border-l border-border p-4">
        <h2 className="font-heading text-lg text-foreground">全局配置</h2>

        <section className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">尺寸比例</h3>
          <div className="grid grid-cols-2 gap-2">
            {CANVAS_SIZE_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onCanvasChange({ width: p.width, height: p.height })}
                className="rounded-lg border border-border px-2 py-1.5 text-xs text-foreground transition-colors hover:border-primary"
              >
                {p.label}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">背景</h3>
          <div className="flex gap-2">
            {(["color", "gradient"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onCanvasChange({ backgroundMode: mode })}
                className={mode === canvas.backgroundMode ? "rounded-lg border border-primary px-2 py-1 text-xs text-primary" : "rounded-lg border border-border px-2 py-1 text-xs text-foreground"}
              >
                {mode === "color" ? "纯色" : "渐变"}
              </button>
            ))}
          </div>
          {canvas.backgroundMode === "color" ? (
            <input type="color" value={canvas.backgroundColor} onChange={(e) => onCanvasChange({ backgroundColor: e.target.value })} className="h-9 w-full cursor-pointer rounded-lg border border-border" />
          ) : (
            <div className="flex gap-2">
              <input type="color" value={canvas.gradient?.from ?? "#FFD1DC"} onChange={(e) => onCanvasChange({ gradient: { from: e.target.value, to: canvas.gradient?.to ?? "#FFE4E1" } })} className="h-9 flex-1 cursor-pointer rounded-lg border border-border" />
              <input type="color" value={canvas.gradient?.to ?? "#FFE4E1"} onChange={(e) => onCanvasChange({ gradient: { from: canvas.gradient?.from ?? "#FFD1DC", to: e.target.value } })} className="h-9 flex-1 cursor-pointer rounded-lg border border-border" />
            </div>
          )}
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">上传背景图</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => onCanvasChange({ backgroundMode: "image", backgroundImage: String(reader.result) });
                reader.readAsDataURL(file);
              }}
              className="w-full text-xs"
            />
          </label>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">画布圆角: {canvas.cornerRadius}</h3>
          <input type="range" min={0} max={120} value={canvas.cornerRadius} onChange={(e) => onCanvasChange({ cornerRadius: Number(e.target.value) })} className="w-full" />
        </section>
      </aside>
    );
  }

  const patch = (p: Partial<CanvasObject>) => onObjectChange(selected.id, p);

  return (
    <aside className="w-72 shrink-0 space-y-4 overflow-y-auto border-l border-border p-4">
      <h2 className="font-heading text-lg text-foreground">
        {selected.type === "text" ? "文本" : selected.type === "bubble" ? "气泡" : selected.type === "emoji" ? "贴纸" : "形状"}
      </h2>
      {(selected.type === "text" || selected.type === "bubble") && (
        <section className="space-y-2">
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">文字</span>
            <textarea value={selected.text} onChange={(e) => patch({ text: e.target.value })} rows={3} className={BASE_INPUT} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">字号: {selected.fontSize}</span>
            <input type="range" min={12} max={200} value={selected.fontSize} onChange={(e) => patch({ fontSize: Number(e.target.value) })} className="w-full" />
          </label>
        </section>
      )}
      {selected.type === "text" && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">文字颜色</span>
            <input type="color" value={selected.fill} onChange={(e) => patch({ fill: e.target.value })} className="h-8 w-12 cursor-pointer rounded border border-border" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">描边颜色</span>
            <input type="color" value={selected.stroke} onChange={(e) => patch({ stroke: e.target.value })} className="h-8 w-12 cursor-pointer rounded border border-border" />
          </div>
          <label className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">描边宽: {selected.strokeWidth}</span>
            <input type="range" min={0} max={12} value={selected.strokeWidth} onChange={(e) => patch({ strokeWidth: Number(e.target.value) })} className="w-32" />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">文本底色</span>
            <input type="color" value={selected.backgroundColor ?? "#000000"} onChange={(e) => patch({ backgroundColor: e.target.value })} className="h-8 w-12 cursor-pointer rounded border border-border" />
          </label>
        </section>
      )}
      {selected.type === "bubble" && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">填充色</span>
            <input type="color" value={selected.fill} onChange={(e) => patch({ fill: e.target.value })} className="h-8 w-12 cursor-pointer rounded border border-border" />
          </div>
          <label className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">圆角: {selected.cornerRadius}</span>
            <input type="range" min={0} max={80} value={selected.cornerRadius} onChange={(e) => patch({ cornerRadius: Number(e.target.value) })} className="w-32" />
          </label>
        </section>
      )}
      {(selected.type === "emoji") && (
        <label className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">字号: {selected.fontSize}</span>
          <input type="range" min={24} max={300} value={selected.fontSize} onChange={(e) => patch({ fontSize: Number(e.target.value) })} className="w-32" />
        </label>
      )}
      {selected.type === "shape" && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">填充色</span>
            <input type="color" value={selected.fill} onChange={(e) => patch({ fill: e.target.value })} className="h-8 w-12 cursor-pointer rounded border border-border" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">描边色</span>
            <input type="color" value={selected.stroke} onChange={(e) => patch({ stroke: e.target.value })} className="h-8 w-12 cursor-pointer rounded border border-border" />
          </div>
        </section>
      )}
    </aside>
  );
}
```

- [ ] **Step 2: 创建工作区 + 页面**

```tsx
// frontend/components/meme-studio/studio-workspace.tsx
"use client";

import { useRef, useState } from "react";
import { CanvasStage } from "@/components/meme-studio/canvas-stage";
import { ComponentPalette } from "@/components/meme-studio/component-palette";
import { PropertyPanel } from "@/components/meme-studio/property-panel";
import { FabricBridge } from "@/lib/meme-studio/fabric-bridge";
import type { CanvasConfig, CanvasObject, MemeSchema } from "@/lib/meme-studio/schema";

const DEFAULT_SCHEMA: MemeSchema = {
  canvas: {
    width: 1080,
    height: 1080,
    backgroundMode: "color",
    backgroundColor: "#FFFFFF",
    gradient: null,
    backgroundImage: null,
    cornerRadius: 0,
  },
  objects: [],
};

export function StudioWorkspace() {
  const [schema, setSchema] = useState<MemeSchema>(DEFAULT_SCHEMA);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const bridgeRef = useRef<FabricBridge | null>(null);

  function handleAdd(obj: CanvasObject) {
    const id = bridgeRef.current?.addObject(obj);
    if (id) setSelectedId(id);
  }

  function handleCanvasChange(patch: Partial<CanvasConfig>) {
    bridgeRef.current?.setCanvasConfig(patch);
  }

  function handleObjectChange(id: string, patch: Partial<CanvasObject>) {
    bridgeRef.current?.updateObject(id, patch);
  }

  function handleDelete() {
    if (!selectedId) return;
    bridgeRef.current?.removeObject(selectedId);
    setSelectedId(null);
  }

  function handleExport() {
    const dataUrl = bridgeRef.current?.toDataURL();
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "meme.png";
    a.click();
  }

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col">
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <h1 className="font-heading text-xl text-foreground">表情包工作室</h1>
        <div className="flex gap-2">
          <button type="button" onClick={handleDelete} disabled={!selectedId} className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:border-destructive hover:text-destructive disabled:opacity-40">
            删除选中
          </button>
          <button type="button" onClick={handleExport} className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground transition-opacity hover:opacity-90">
            导出 PNG
          </button>
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <ComponentPalette onAdd={handleAdd} />
        <CanvasStage
          schema={schema}
          bridgeRef={bridgeRef}
          onSchemaChange={setSchema}
          onSelectionChange={setSelectedId}
        />
        <PropertyPanel
          schema={schema}
          selectedId={selectedId}
          onCanvasChange={handleCanvasChange}
          onObjectChange={handleObjectChange}
        />
      </div>
    </div>
  );
}
```

```tsx
// frontend/app/meme-studio/page.tsx
import { StudioWorkspace } from "@/components/meme-studio/studio-workspace";

export default function MemeStudioPage() {
  return <StudioWorkspace />;
}
```

```tsx
// frontend/app/meme-studio/loading.tsx
export default function Loading() {
  return (
    <div className="flex h-[calc(100dvh-4rem)] animate-pulse flex-col bg-muted/30">
      <div className="h-14 border-b border-border" />
      <div className="flex flex-1">
        <div className="w-56 border-r border-border" />
        <div className="flex-1" />
        <div className="w-72 border-l border-border" />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 修改首页快捷直达入口**

`frontend/components/home/quick-links-section.tsx`{CL}找到 meme 卡片:

```tsx
  {
    href: "/meme",
    title: "一键生成猫咪表情包",
    description: "上传猫咪照片，秒变斗图神器。",
```
改为:

```tsx
  {
    href: "/meme-studio",
    title: "表情包工作室",
    description: "拖拽拼装文字与贴纸，创作专属表情包。",
```

- [ ] **Step 4: 更新 PRD.md(新增 3.6 章节)**

在 3.5 章节之后、第 4 章之前插入(用转义序列处理全角标点):

```markdown
### 3.6 表情包工作室(前端开发中)

**定位：** 低代码画布式表情包编辑器，用户手动拼装设计，与 3.4(多模态自动生成，后端已就绪、待模型选型)并存。

#### 功能描述

| 要素 | 说明 |
| --- | --- |
| 画布 | 纯色/渐变/上传图片背景，4 种尺寸预设 + 自定义 |
| 组件 | 文本、气泡(预设样式)、emoji 贴纸、基础形状(圆/心/星) |
| 交互 | 左侧添加组件、画布拖拽/缩放/旋转、选中即时联动右侧属性面板 |
| 属性 | 全局配置(背景/圆角/尺寸)与组件配置(文字/颜色/字号等)实时同步 |
| 输出 | 导出 PNG(原始尺寸 + 圆角裁剪) |

#### 技术要点

- Fabric.js 画布引擎，Schema 驱动(数据唯一源)
- FabricBridge 双向同步(画布操作 ↔ Schema ↔ 属性面板)
- 纯前端模块，不依赖后端与多模态模型
```

并在实现进度总览更新{CL}3.6 加入:

```
> **实现进度(2026-08-11)**：3.1-3.3、3.5 前后端已完成;3.4 后端已完成、前端待开发;3.6 表情包工作室前端开发中;数据库(PostgreSQL + pgvector)已接入。
```

- [ ] **Step 5: 类型 + lint + 构建**

Run: `bunx tsc --noEmit && bun lint && bun run build`
Expected: 零错误;路由表含 `/meme-studio`

- [ ] **Step 6: 结束任务验证**

```bash
git status --short
```
Expected: 新增 meme-studio 相关文件,修改 quick-links-section.tsx、PRD.md(不提交)

---

### Task 6: 端到端验证(Playwright)

**Files:**
- 无新文件{CL}验证既有行为

**Interfaces:**
- Consumes: Task 1-5 的全部功能(纯前端{CL}无需后端)

- [ ] **Step 1: 启动前端**

Run: `cd /Users/renxusheng/Documents/AI/MiaoMiaoVerse/frontend && bun dev > /tmp/e2e_studio.log 2>&1 &`{CL}等待 8 秒{CL}curl 确认 `/meme-studio` 200

- [ ] **Step 2: Playwright 验证**

用浏览器工具:
1. `browser_navigate` → `http://localhost:3000/meme-studio`{CL}`browser_snapshot`{CL}确认三栏布局(组件面板/画布/全局配置面板)
2. 点"添加文本" → 画布出现文本{C}自动选中{CL}右侧切文本配置{CL}`browser_evaluate` 检查 canvas 内对象数 = 1
3. 属性面板改文字 → `browser_evaluate` 检查画布文本内容同步
4. 添加 emoji/形状/气泡 各一 → 对象数 = 4
5. 画布点击某组件 → 选中高亮{CL}右侧联动;点画布空白处 → 回退全局配置
6. 全局配置改背景色 → `browser_evaluate` 检查 canvas 背景变化;切渐变/上传图片
7. 切尺寸预设(竖图) → canvas 尺寸变化
8. 导出:点"导出 PNG" → `browser_evaluate` 检查生成了下载(dataURL 非空;Playwright 中下载行为以 console/新 tab 形式验证{CL}或检查 a[download] 点击后无报错)
9. `browser_console_messages(level: "error")` → 无错误
10. 首页:`browser_navigate` → `/`{CL}快捷直达卡"表情包工作室"存在且 href 指向 /meme-studio
11. 响应式:`browser_resize(390×844)` → 三栏压缩(面板折叠为可用状态{CL}以无溢出/可操作为准)

- [ ] **Step 3: 收尾**

Run:
```bash
grep -icE "error|exception" /tmp/e2e_studio.log || echo "logs clean"
pkill -f "next dev" 2>/dev/null
git status --short
```
Expected: 日志干净;新增全部 meme-studio 文件{CL}修改 quick-links/PRD{CL}均未提交
