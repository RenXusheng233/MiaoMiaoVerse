// Component palette — the left panel listing everything a user can drop onto
// the canvas: text, bubble presets, emoji stickers, and basic shapes. Every
// button produces a fresh object per click via the preset factories.
'use client'

import {
  BUBBLE_PRESETS,
  EMOJI_SET,
  createDefaultObject,
  createShapeObject,
  type BubblePresetId,
} from '@/lib/meme-studio/presets'
import type {
  BubbleObject,
  CanvasObject,
  EmojiObject,
  ShapeKind,
} from '@/lib/meme-studio/schema'

interface ComponentPaletteProps {
  onAdd: (obj: CanvasObject) => void
}

export function ComponentPalette({ onAdd }: ComponentPaletteProps) {
  return (
    <aside className="w-56 shrink-0 space-y-4 overflow-y-auto border-r border-border p-4">
      <h2 className="font-heading text-lg text-foreground">组件</h2>

      <section>
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">文本</h3>
        <button
          type="button"
          onClick={() => onAdd(createDefaultObject('text'))}
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
              onClick={() => {
                const p = BUBBLE_PRESETS[id]
                onAdd({
                  ...createDefaultObject('bubble'),
                  preset: id,
                  fill: p.fill,
                  fillOpacity: p.fillOpacity,
                  stroke: p.stroke,
                  strokeWidth: p.strokeWidth,
                  cornerRadius: p.cornerRadius,
                } as BubbleObject)
              }}
              className="w-full rounded-xl border border-border px-4 py-3 text-left text-sm text-foreground transition-colors hover:border-primary hover:text-primary"
            >
              {BUBBLE_PRESETS[id].label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">
          emoji 贴纸
        </h3>
        <div className="grid grid-cols-4 gap-2">
          {EMOJI_SET.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() =>
                onAdd({ ...createDefaultObject('emoji'), emoji } as EmojiObject)
              }
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
          {(
            [
              'circle',
              'heart',
              'star',
              'square',
              'triangle',
              'diamond',
            ] as ShapeKind[]
          ).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => onAdd(createShapeObject(kind))}
              className="flex h-11 items-center justify-center rounded-xl border border-border text-lg transition-colors hover:border-primary"
            >
              {kind === 'circle'
                ? '●'
                : kind === 'heart'
                  ? '♥'
                  : kind === 'star'
                    ? '★'
                    : kind === 'square'
                      ? '■'
                      : kind === 'triangle'
                        ? '▲'
                        : '◆'}
            </button>
          ))}
        </div>
      </section>
    </aside>
  )
}
