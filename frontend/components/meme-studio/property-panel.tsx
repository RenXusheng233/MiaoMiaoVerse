// Property panel — the right-hand inspector. With nothing selected it edits
// the global canvas config (size presets, background, corner radius); with an
// object selected it edits that object's props. Every change is emitted via
// onCanvasChange / onObjectChange — the workspace routes them through the
// FabricBridge, never mutating the schema directly.
'use client'

import { useState } from 'react'
import { CANVAS_SIZE_PRESETS } from '@/lib/meme-studio/canvas-size'
import type {
  CanvasConfig,
  CanvasObject,
  MemeSchema,
} from '@/lib/meme-studio/schema'

interface PropertyPanelProps {
  schema: MemeSchema
  selectedId: string | null
  onCanvasChange: (patch: Partial<CanvasConfig>) => void
  onObjectChange: (id: string, patch: Partial<CanvasObject>) => void
}

const BASE_INPUT =
  'w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring'

/** Custom-size bounds — sane meme canvas dimensions. */
const MIN_SIZE = 100
const MAX_SIZE = 4096

function clampSize(v: number): number {
  if (Number.isNaN(v)) return MIN_SIZE
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(v)))
}

export function PropertyPanel({
  schema,
  selectedId,
  onCanvasChange,
  onObjectChange,
}: PropertyPanelProps) {
  const canvas = schema.canvas
  const selected = selectedId
    ? schema.objects.find((o) => o.id === selectedId)
    : undefined
  // 自定义 size mode — a panel-local flag: presets are one-click sizes, the
  // custom button reveals width/height inputs instead of applying a size.
  const [customSize, setCustomSize] = useState(false)

  if (!selected) {
    return (
      <aside className="w-72 shrink-0 space-y-4 overflow-y-auto border-l border-border p-4">
        <h2 className="font-heading text-lg text-foreground">全局配置</h2>

        <section className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            尺寸比例
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {CANVAS_SIZE_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onCanvasChange({ width: p.width, height: p.height })
                  setCustomSize(false)
                }}
                className="rounded-lg border border-border px-2 py-1.5 text-xs text-foreground transition-colors hover:border-primary"
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCustomSize(true)}
              className={
                customSize
                  ? 'rounded-lg border border-primary px-2 py-1.5 text-xs text-primary'
                  : 'rounded-lg border border-border px-2 py-1.5 text-xs text-foreground transition-colors hover:border-primary'
              }
            >
              自定义
            </button>
          </div>
          {customSize ? (
            <div className="flex items-center gap-2 text-xs">
              <label className="flex items-center gap-1">
                宽
                <input
                  type="number"
                  min={MIN_SIZE}
                  max={MAX_SIZE}
                  value={canvas.width}
                  onChange={(e) =>
                    onCanvasChange({
                      width: clampSize(Number(e.target.value)),
                    })
                  }
                  className="w-20 rounded-lg border border-input bg-transparent px-2 py-1"
                />
              </label>
              <label className="flex items-center gap-1">
                高
                <input
                  type="number"
                  min={MIN_SIZE}
                  max={MAX_SIZE}
                  value={canvas.height}
                  onChange={(e) =>
                    onCanvasChange({
                      height: clampSize(Number(e.target.value)),
                    })
                  }
                  className="w-20 rounded-lg border border-input bg-transparent px-2 py-1"
                />
              </label>
            </div>
          ) : null}
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">背景</h3>
          <div className="flex gap-2">
            {(['color', 'gradient'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onCanvasChange({ backgroundMode: mode })}
                className={
                  mode === canvas.backgroundMode
                    ? 'rounded-lg border border-primary px-2 py-1 text-xs text-primary'
                    : 'rounded-lg border border-border px-2 py-1 text-xs text-foreground'
                }
              >
                {mode === 'color' ? '纯色' : '渐变'}
              </button>
            ))}
          </div>
          {canvas.backgroundMode === 'color' ? (
            <input
              type="color"
              key="bg-color"
              value={canvas.backgroundColor}
              onChange={(e) =>
                onCanvasChange({ backgroundColor: e.target.value })
              }
              className="h-9 w-full cursor-pointer rounded-lg border border-border"
            />
          ) : (
            <div className="flex gap-2">
              <input
                type="color"
                key="grad-from"
                value={canvas.gradient?.from ?? '#FFD1DC'}
                onChange={(e) =>
                  onCanvasChange({
                    gradient: {
                      from: e.target.value,
                      to: canvas.gradient?.to ?? '#FFE4E1',
                    },
                  })
                }
                className="h-9 flex-1 cursor-pointer rounded-lg border border-border"
              />
              <input
                type="color"
                key="grad-to"
                value={canvas.gradient?.to ?? '#FFE4E1'}
                onChange={(e) =>
                  onCanvasChange({
                    gradient: {
                      from: canvas.gradient?.from ?? '#FFD1DC',
                      to: e.target.value,
                    },
                  })
                }
                className="h-9 flex-1 cursor-pointer rounded-lg border border-border"
              />
            </div>
          )}
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">
              上传背景图
            </span>
            <input
              type="file"
              key="bg-file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = () =>
                  onCanvasChange({
                    backgroundMode: 'image',
                    backgroundImage: String(reader.result),
                  })
                reader.readAsDataURL(file)
                // Reset the input so re-picking the SAME file fires onChange
                // again (browsers otherwise swallow the duplicate pick).
                e.target.value = ''
              }}
              className="w-full text-xs"
            />
          </label>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            画布圆角: {canvas.cornerRadius}
          </h3>
          <input
            type="range"
            min={0}
            max={120}
            value={canvas.cornerRadius}
            onChange={(e) =>
              onCanvasChange({ cornerRadius: Number(e.target.value) })
            }
            className="w-full"
          />
        </section>
      </aside>
    )
  }

  const patch = (p: Partial<CanvasObject>) => onObjectChange(selected.id, p)

  return (
    <aside className="w-72 shrink-0 space-y-4 overflow-y-auto border-l border-border p-4">
      <h2 className="font-heading text-lg text-foreground">
        {selected.type === 'text'
          ? '文本'
          : selected.type === 'bubble'
            ? '气泡'
            : selected.type === 'emoji'
              ? '贴纸'
              : '形状'}
      </h2>
      {(selected.type === 'text' || selected.type === 'bubble') && (
        <section className="space-y-2">
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">
              文字
            </span>
            <textarea
              value={selected.text}
              onChange={(e) => patch({ text: e.target.value })}
              rows={3}
              className={BASE_INPUT}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">
              字号: {selected.fontSize}
            </span>
            <input
              type="range"
              min={12}
              max={200}
              value={selected.fontSize}
              onChange={(e) => patch({ fontSize: Number(e.target.value) })}
              className="w-full"
            />
          </label>
        </section>
      )}
      {selected.type === 'text' && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">文字颜色</span>
            <input
              type="color"
              key="text-fill"
              value={selected.fill}
              onChange={(e) => patch({ fill: e.target.value })}
              className="h-8 w-12 cursor-pointer rounded border border-border"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">描边颜色</span>
            <input
              type="color"
              key="text-stroke"
              value={selected.stroke}
              onChange={(e) => patch({ stroke: e.target.value })}
              className="h-8 w-12 cursor-pointer rounded border border-border"
            />
          </div>
          <label className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              描边宽: {selected.strokeWidth}
            </span>
            <input
              type="range"
              min={0}
              max={12}
              value={selected.strokeWidth}
              onChange={(e) => patch({ strokeWidth: Number(e.target.value) })}
              className="w-32"
            />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">文本底色</span>
            <input
              type="color"
              key="text-bg"
              value={selected.backgroundColor ?? '#000000'}
              onChange={(e) => patch({ backgroundColor: e.target.value })}
              className="h-8 w-12 cursor-pointer rounded border border-border"
            />
          </label>
        </section>
      )}
      {selected.type === 'bubble' && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">填充色</span>
            <input
              type="color"
              key="bubble-fill"
              value={selected.fill}
              onChange={(e) => patch({ fill: e.target.value })}
              className="h-8 w-12 cursor-pointer rounded border border-border"
            />
          </div>
          <label className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              圆角: {selected.cornerRadius}
            </span>
            <input
              type="range"
              min={0}
              max={80}
              value={selected.cornerRadius}
              onChange={(e) => patch({ cornerRadius: Number(e.target.value) })}
              className="w-32"
            />
          </label>
        </section>
      )}
      {selected.type === 'emoji' && (
        <label className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            字号: {selected.fontSize}
          </span>
          <input
            type="range"
            min={24}
            max={300}
            value={selected.fontSize}
            onChange={(e) => patch({ fontSize: Number(e.target.value) })}
            className="w-32"
          />
        </label>
      )}
      {selected.type === 'shape' && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">填充色</span>
            <input
              type="color"
              key="shape-fill"
              value={selected.fill}
              onChange={(e) => patch({ fill: e.target.value })}
              className="h-8 w-12 cursor-pointer rounded border border-border"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">描边色</span>
            <input
              type="color"
              key="shape-stroke"
              value={selected.stroke}
              onChange={(e) => patch({ stroke: e.target.value })}
              className="h-8 w-12 cursor-pointer rounded border border-border"
            />
          </div>
        </section>
      )}
    </aside>
  )
}
