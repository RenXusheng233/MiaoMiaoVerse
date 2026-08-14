// MemeStudio schema — the single source of truth for the canvas editor.
// Canvas rendering, the property panel, and PNG export are all driven by MemeSchema.

// The BubblePresetId union is defined in presets.ts (Task 2) — import the type
// rather than redeclaring it here to keep a single source of truth.
import type { BubblePresetId } from './presets'

export type CanvasObjectType = 'text' | 'bubble' | 'emoji' | 'shape'
export type ShapeKind = 'circle' | 'heart' | 'star'
export type BackgroundMode = 'color' | 'gradient' | 'image'

export interface BaseObject {
  id: string
  type: CanvasObjectType
  left: number
  top: number
  scaleX: number
  scaleY: number
  angle: number
  opacity: number
}

export interface TextObject extends BaseObject {
  type: 'text'
  text: string
  fontSize: number
  fill: string
  stroke: string
  strokeWidth: number
  backgroundColor: string | null
  cornerRadius: number
}

export interface BubbleObject extends BaseObject {
  type: 'bubble'
  preset: BubblePresetId
  text: string
  fontSize: number
  fill: string
  cornerRadius: number
}

export interface EmojiObject extends BaseObject {
  type: 'emoji'
  emoji: string
  fontSize: number
}

export interface ShapeObject extends BaseObject {
  type: 'shape'
  shape: ShapeKind
  fill: string
  stroke: string
  strokeWidth: number
}

export type CanvasObject = TextObject | BubbleObject | EmojiObject | ShapeObject

export interface CanvasConfig {
  width: number
  height: number
  backgroundMode: BackgroundMode
  backgroundColor: string
  gradient: { from: string; to: string } | null
  backgroundImage: string | null // dataURL
  cornerRadius: number
}

export interface MemeSchema {
  canvas: CanvasConfig
  objects: CanvasObject[]
}
