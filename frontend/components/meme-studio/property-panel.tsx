// Property panel — the right-hand inspector. With nothing selected it edits
// the global canvas config (size presets, background, corner radius); with an
// object selected, the per-type field registry (property-fields.ts) drives a
// generic renderer. Every change is emitted via onCanvasChange /
// onObjectChange — the workspace routes them through the FabricBridge, never
// mutating the schema directly.
'use client'

import { useState } from 'react'
import { CANVAS_SIZE_PRESETS } from '@/lib/meme-studio/canvas-size'
import {
  OBJECT_PROPERTY_CONFIGS,
  type ObjectFieldConfig,
} from '@/lib/meme-studio/property-fields'
import type {
  CanvasConfig,
  CanvasObject,
  MemeSchema,
} from '@/lib/meme-studio/schema'
import { cn } from '@/lib/utils'

import styles from './meme-studio.module.css'

interface PropertyPanelProps {
  schema: MemeSchema
  selectedId: string | null
  onCanvasChange: (patch: Partial<CanvasConfig>) => void
  onObjectChange: (id: string, patch: Partial<CanvasObject>) => void
}

const BASE_INPUT = styles['studio-input']

/** Custom-size bounds — sane meme canvas dimensions. */
const MIN_SIZE = 100
const MAX_SIZE = 4096

function clampSize(v: number): number {
  if (Number.isNaN(v)) return MIN_SIZE
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(v)))
}

interface FieldEditorProps {
  field: ObjectFieldConfig
  objectId: string
  value: unknown
  onChange: (key: string, value: string | number) => void
}

// Generic field renderer — the only place that paints field kinds. The config
// registry (property-fields.ts) guarantees keys exist on the schema object at
// authoring time; here keys are treated as plain strings.
function FieldEditor({ field, objectId, value, onChange }: FieldEditorProps) {
  switch (field.kind) {
    case 'textarea':
      return (
        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">
            {field.label}
          </span>
          <textarea
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(field.key, e.target.value)}
            rows={3}
            className={BASE_INPUT}
          />
        </label>
      )
    case 'slider': {
      // Opacity fields store 0–1 but edit 0–100 — fromSchema/toSchema convert
      // at the boundaries; format renders the label suffix.
      const schemaValue = typeof value === 'number' ? value : field.min
      const sliderValue = field.fromSchema
        ? field.fromSchema(schemaValue)
        : schemaValue
      const display = field.format ? field.format(sliderValue) : sliderValue
      return (
        <label className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {field.label}: {display}
          </span>
          <input
            type="range"
            min={field.min}
            max={field.max}
            step={field.step ?? 1}
            value={sliderValue}
            onChange={(e) => {
              const raw = Number(e.target.value)
              onChange(field.key, field.toSchema ? field.toSchema(raw) : raw)
            }}
            className="w-32"
          />
        </label>
      )
    }
    case 'color':
      // objectId in the key remounts the input per selection — browsers keep
      // stale picker state on a reused DOM node otherwise.
      return (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{field.label}</span>
          <input
            type="color"
            key={`${objectId}-${field.key}`}
            value={typeof value === 'string' ? value : '#000000'}
            onChange={(e) => onChange(field.key, e.target.value)}
            className="h-8 w-12 cursor-pointer rounded border border-border"
          />
        </div>
      )
    default:
      return null
  }
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
  // Selected background file name. The file input is reset after every pick
  // (so re-picking the SAME file still fires onChange), which also wipes the
  // browser's native "未选择任何文件" display — so the name is tracked here
  // and rendered by us instead of relying on the input's own value.
  const [bgFileName, setBgFileName] = useState<string | null>(null)

  if (!selected) {
    return (
      <aside
        className={cn(
          styles['studio-panel'],
          styles['studio-inspector'],
          'space-y-4',
        )}
      >
        <h2>全局配置</h2>

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
                className={
                  // Highlight the preset matching the current canvas size —
                  // the default square preset was never visibly selected.
                  p.width === canvas.width && p.height === canvas.height
                    ? 'rounded-lg border border-primary px-2 py-1.5 text-xs text-primary'
                    : 'rounded-lg border border-border px-2 py-1.5 text-xs text-foreground transition-colors hover:border-primary'
                }
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
                onClick={() => {
                  onCanvasChange({ backgroundMode: mode })
                  setBgFileName(null)
                }}
                // Mode switching is locked while a background image is up —
                // delete the image first to re-enable color modes.
                disabled={canvas.backgroundMode === 'image'}
                className={
                  mode === canvas.backgroundMode
                    ? 'rounded-lg border border-primary px-2 py-1 text-xs text-primary disabled:opacity-50'
                    : 'rounded-lg border border-border px-2 py-1 text-xs text-foreground disabled:cursor-not-allowed disabled:opacity-50'
                }
              >
                {mode === 'color' ? '纯色' : '渐变'}
              </button>
            ))}
          </div>
          {canvas.backgroundMode === 'gradient' ? (
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
          ) : (
            // Solid-color picker doubles as the disabled stand-in while a
            // background image is up — it must read as a color mode, not the
            // gradient pickers that previously leaked into image mode.
            <input
              type="color"
              key="bg-color"
              value={canvas.backgroundColor}
              onChange={(e) =>
                onCanvasChange({ backgroundColor: e.target.value })
              }
              disabled={canvas.backgroundMode === 'image'}
              className="h-9 w-full cursor-pointer rounded-lg border border-border disabled:cursor-not-allowed disabled:opacity-50"
            />
          )}
          <div>
            <span className="mb-1 block text-xs text-muted-foreground">
              上传背景图
            </span>
            <div className="flex items-center gap-2">
              <label className="block min-w-0 flex-1 cursor-pointer">
                <input
                  type="file"
                  key="bg-file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    setBgFileName(file.name)
                    const reader = new FileReader()
                    reader.onload = () =>
                      onCanvasChange({
                        backgroundMode: 'image',
                        backgroundImage: String(reader.result),
                      })
                    reader.readAsDataURL(file)
                    // Reset the input so re-picking the SAME file fires
                    // onChange again (browsers otherwise swallow the
                    // duplicate pick). The name is already in state, so the
                    // reset can't blank the UI.
                    e.target.value = ''
                  }}
                  className="sr-only"
                />
                <span className="block w-full truncate rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-xs text-foreground transition-colors hover:border-primary">
                  {bgFileName ?? '未选择任何文件'}
                </span>
              </label>
              {canvas.backgroundImage ? (
                <button
                  type="button"
                  onClick={() => {
                    // Remove the background image: back to solid color, which
                    // also re-enables the disabled color controls.
                    onCanvasChange({
                      backgroundMode: 'color',
                      backgroundImage: null,
                    })
                    setBgFileName(null)
                  }}
                  className="shrink-0 rounded-lg border border-border px-2 py-1.5 text-xs text-foreground transition-colors hover:border-destructive hover:text-destructive"
                >
                  删除
                </button>
              ) : null}
            </div>
          </div>
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

  // Object view: the selected component's fields come from the per-type
  // registry (property-fields.ts) — declarative config, compiler-checked
  // against the schema union. FieldEditor renders each entry generically.
  const config = OBJECT_PROPERTY_CONFIGS[selected.type]

  return (
    <aside
      className={cn(
        styles['studio-panel'],
        styles['studio-inspector'],
        'space-y-4',
      )}
    >
      <h2>{config.title}</h2>
      <section className="space-y-2">
        {config.fields.map((field) => (
          <FieldEditor
            key={field.key}
            field={field}
            objectId={selected.id}
            // Dynamic key read — Reflect.get keeps the union object intact
            // (an `as Record` cast would trip the interface index-signature
            // check).
            value={Reflect.get(selected, field.key)}
            onChange={(key, v) =>
              onObjectChange(selected.id, { [key]: v } as Partial<CanvasObject>)
            }
          />
        ))}
      </section>
    </aside>
  )
}
