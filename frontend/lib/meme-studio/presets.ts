// Component presets for MemeStudio — bubble styles, emoji set, and factories
// that produce fresh CanvasObject instances for the canvas editor.
import type {
  CanvasObject,
  CanvasObjectType,
  ShapeKind,
  ShapeObject,
} from './schema'

export type BubblePresetId = 'default' | 'speech' | 'thought'

export const BUBBLE_PRESETS: Record<
  BubblePresetId,
  { label: string; fill: string; cornerRadius: number }
> = {
  default: { label: '圆角气泡', fill: '#FFFFFF', cornerRadius: 24 },
  speech: { label: '对话气泡', fill: '#FFF7E6', cornerRadius: 32 },
  thought: { label: '气泡', fill: '#E8F4FD', cornerRadius: 16 },
}

export const EMOJI_SET = [
  '😂',
  '🐱',
  '✨',
  '💥',
  '❤️',
  '😾',
  '🍗',
  '💤',
  '🤔',
  '😻',
  '🙀',
  '👍',
]

export function createShapeObject(kind: ShapeKind): ShapeObject {
  return {
    id: crypto.randomUUID(),
    type: 'shape',
    shape: kind,
    left: 400,
    top: 300,
    scaleX: 1,
    scaleY: 1,
    angle: 0,
    opacity: 1,
    fill: '#FFD1DC',
    stroke: '#000000',
    strokeWidth: 0,
  }
}

export function createDefaultObject(type: CanvasObjectType): CanvasObject {
  const base = {
    id: crypto.randomUUID(),
    left: 400,
    top: 300,
    scaleX: 1,
    scaleY: 1,
    angle: 0,
    opacity: 1,
  }
  switch (type) {
    case 'text':
      return {
        ...base,
        type,
        text: '双击编辑文字',
        fontSize: 64,
        fill: '#FFFFFF',
        stroke: '#000000',
        strokeWidth: 4,
        backgroundColor: null,
        cornerRadius: 0,
      }
    case 'bubble':
      return {
        ...base,
        type,
        preset: 'default',
        text: '喵呜~',
        fontSize: 48,
        fill: '#FFFFFF',
        cornerRadius: 24,
      }
    case 'emoji':
      return { ...base, type, emoji: EMOJI_SET[0], fontSize: 120 }
    case 'shape':
      return createShapeObject('circle')
  }
}
