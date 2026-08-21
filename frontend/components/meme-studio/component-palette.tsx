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
import { cn } from '@/lib/utils'

import styles from './meme-studio.module.css'

interface ComponentPaletteProps {
  onAdd: (obj: CanvasObject) => void
}

export function ComponentPalette({ onAdd }: ComponentPaletteProps) {
  return (
    <aside
      className={cn(
        styles['studio-panel'],
        styles['studio-palette'],
        'space-y-4',
      )}
    >
      <h2>组件</h2>

      <section>
        <h3 className="mb-2">文本</h3>
        <button
          type="button"
          onClick={() => onAdd(createDefaultObject('text'))}
          className={cn(
            styles['palette-button'],
            'w-full rounded-xl border px-4 py-3 text-left text-sm',
          )}
        >
          添加文本
        </button>
      </section>

      <section>
        <h3 className="mb-2">气泡</h3>
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
              className={cn(
                styles['palette-button'],
                'w-full rounded-xl border px-4 py-3 text-left text-sm',
              )}
            >
              {BUBBLE_PRESETS[id].label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2">emoji 贴纸</h3>
        <div className="grid grid-cols-4 gap-2">
          {EMOJI_SET.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() =>
                onAdd({ ...createDefaultObject('emoji'), emoji } as EmojiObject)
              }
              className={cn(
                styles['palette-icon-button'],
                'flex h-11 items-center justify-center rounded-xl border text-xl',
              )}
            >
              {emoji}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2">形状</h3>
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
              className={cn(
                styles['palette-icon-button'],
                'flex h-11 items-center justify-center rounded-xl border text-lg',
              )}
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
