// Property field configs for the canvas editor — a declarative registry that
// maps each component type to the fields its property panel renders. Adding a
// new component type (schema member + preset factory + palette button) now
// needs zero changes in property-panel: define its config here and the
// generic FieldEditor renders it.
import type {
  BubbleObject,
  CanvasObject,
  EmojiObject,
  ShapeObject,
  TextObject,
} from './schema'

/** Keys of O whose values are numbers (slider targets). */
type NumericKeys<O> = {
  [K in keyof O]: O[K] extends number ? K : never
}[keyof O]

/** Keys of O whose values are strings (color/text targets; null allowed so
 *  `backgroundColor: string | null` stays selectable). */
type StringKeys<O> = {
  [K in keyof O]: O[K] extends string | null ? K : never
}[keyof O]

interface FieldConfigBase {
  label: string
}

/** Multi-line text input (bubble / text content). */
export interface TextareaField<O extends CanvasObject> extends FieldConfigBase {
  kind: 'textarea'
  key: StringKeys<O>
}

/** Range slider. The schema value may live on a different scale than the
 *  slider range (e.g. opacity stored 0–1, edited 0–100) — fromSchema/toSchema
 *  convert at the boundaries, format controls the label suffix. */
export interface SliderField<O extends CanvasObject> extends FieldConfigBase {
  kind: 'slider'
  key: NumericKeys<O>
  min: number
  max: number
  step?: number
  fromSchema?: (v: number) => number
  toSchema?: (v: number) => number
  format?: (v: number) => string
}

/** Native color picker. */
export interface ColorField<O extends CanvasObject> extends FieldConfigBase {
  kind: 'color'
  key: StringKeys<O>
}

export type FieldConfig<O extends CanvasObject> =
  TextareaField<O> | SliderField<O> | ColorField<O>

/** Widened union the renderer consumes — per-type key checks happen when the
 *  registry below is authored, so the generic editor can treat keys as plain
 *  strings. */
export type ObjectFieldConfig =
  | FieldConfig<TextObject>
  | FieldConfig<BubbleObject>
  | FieldConfig<EmojiObject>
  | FieldConfig<ShapeObject>

export interface ObjectPropertyConfig<O extends CanvasObject> {
  title: string
  fields: FieldConfig<O>[]
}

// Opacity sliders edit 0–100 but store 0–1 in the schema — shared conversion,
// reused by the bubble background and shape fill.
const OPACITY_SLIDER = {
  min: 0,
  max: 100,
  fromSchema: (v: number) => Math.round(v * 100),
  toSchema: (v: number) => v / 100,
  format: (v: number) => `${v}%`,
} as const

/** Per-type registry — each config's key set is compiler-checked against that
 *  type's schema member (a slider on a string field fails to compile). */
export const OBJECT_PROPERTY_CONFIGS: {
  text: ObjectPropertyConfig<TextObject>
  bubble: ObjectPropertyConfig<BubbleObject>
  emoji: ObjectPropertyConfig<EmojiObject>
  shape: ObjectPropertyConfig<ShapeObject>
} = {
  text: {
    title: '文本',
    fields: [
      { kind: 'textarea', key: 'text', label: '文字' },
      { kind: 'slider', key: 'fontSize', label: '字号', min: 12, max: 200 },
      { kind: 'color', key: 'fill', label: '文字颜色' },
      { kind: 'color', key: 'stroke', label: '描边颜色' },
      { kind: 'slider', key: 'strokeWidth', label: '描边宽', min: 0, max: 12 },
      { kind: 'color', key: 'backgroundColor', label: '文本底色' },
    ],
  },
  bubble: {
    title: '气泡',
    fields: [
      { kind: 'textarea', key: 'text', label: '文字' },
      { kind: 'slider', key: 'fontSize', label: '字号', min: 12, max: 200 },
      { kind: 'color', key: 'fill', label: '填充色' },
      {
        kind: 'slider',
        key: 'fillOpacity',
        label: '背景透明度',
        ...OPACITY_SLIDER,
      },
      { kind: 'color', key: 'stroke', label: '边框颜色' },
      { kind: 'slider', key: 'strokeWidth', label: '边框宽', min: 0, max: 12 },
      {
        kind: 'slider',
        key: 'paddingY',
        label: '上下内边距',
        min: 0,
        max: 100,
      },
      {
        kind: 'slider',
        key: 'paddingX',
        label: '左右内边距',
        min: 0,
        max: 100,
      },
      { kind: 'slider', key: 'cornerRadius', label: '圆角', min: 0, max: 80 },
    ],
  },
  emoji: {
    title: '贴纸',
    fields: [
      { kind: 'slider', key: 'fontSize', label: '字号', min: 24, max: 300 },
    ],
  },
  shape: {
    title: '形状',
    fields: [
      { kind: 'color', key: 'fill', label: '填充色' },
      {
        kind: 'slider',
        key: 'fillOpacity',
        label: '填充透明度',
        ...OPACITY_SLIDER,
      },
      { kind: 'color', key: 'stroke', label: '描边色' },
      { kind: 'slider', key: 'strokeWidth', label: '边框宽', min: 0, max: 12 },
    ],
  },
}
