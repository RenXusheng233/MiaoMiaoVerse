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
  {
    label: string
    fill: string
    fillOpacity: number
    stroke: string
    strokeWidth: number
    cornerRadius: number
  }
> = {
  // Solid pink, big radius, no border — the classic sticker bubble.
  default: {
    label: '实心气泡',
    fill: '#FFB6C1',
    fillOpacity: 1,
    stroke: '#000000',
    strokeWidth: 0,
    cornerRadius: 28,
  },
  // Transparent container with a bold ink outline — reads as a speech
  // bubble outline and shows off the transparency control.
  speech: {
    label: '描边气泡',
    fill: '#FFFFFF',
    fillOpacity: 0,
    stroke: '#4A3728',
    strokeWidth: 3,
    cornerRadius: 16,
  },
  // Yellow base with an orange rim, small radius.
  thought: {
    label: '贴纸气泡',
    fill: '#FFE9A8',
    fillOpacity: 1,
    stroke: '#FF9F1C',
    strokeWidth: 2,
    cornerRadius: 10,
  },
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
    fillOpacity: 1,
    // A nonzero default so the border control visibly works out of the box
    // (the old 0-width stroke made the 描边色 picker a no-op).
    stroke: '#000000',
    strokeWidth: 4,
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
        fillOpacity: 1,
        stroke: '#000000',
        strokeWidth: 0,
        paddingX: 0,
        paddingY: 0,
        cornerRadius: 24,
      }
    case 'emoji':
      return { ...base, type, emoji: EMOJI_SET[0], fontSize: 120 }
    case 'shape':
      return createShapeObject('circle')
  }
}
