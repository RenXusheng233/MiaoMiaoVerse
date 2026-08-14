// Pure functions mapping between MemeStudio schema objects and fabric.js
// constructor options — no fabric imports here, so these are fully testable.
import type { CanvasObject, ShapeKind } from './schema'

/**
 * Fixed ink color for bubble text. The bubble's schema `fill` IS the
 * container color (rendered as the text background), so text needs its own
 * high-contrast color rather than the pastel preset fill.
 */
export const BUBBLE_TEXT_FILL = '#4A3728'

/** Map a schema object to fabric.js constructor options (pure, testable). */
export function schemaToFabricOptions(
  obj: CanvasObject,
): Record<string, unknown> {
  const common = {
    left: obj.left,
    top: obj.top,
    scaleX: obj.scaleX,
    scaleY: obj.scaleY,
    angle: obj.angle,
    opacity: obj.opacity,
  }
  // NOTE: never pass `type` in the options — the fabric class is decided by
  // which constructor is called below (Textbox / Path / Circle). Fabric 7's
  // IText overrides `type` with a getter-only accessor, so `_setOptions` ->
  // `set('type', ...)` throws "Cannot set property type ... has only a getter".
  switch (obj.type) {
    case 'text':
      return {
        ...common,
        text: obj.text,
        fontSize: obj.fontSize,
        fill: obj.fill,
        stroke: obj.stroke,
        strokeWidth: obj.strokeWidth,
        backgroundColor: obj.backgroundColor,
        cornerRadius: obj.cornerRadius,
      }
    case 'bubble':
      return {
        ...common,
        text: obj.text,
        fontSize: obj.fontSize,
        // The preset fill paints the rounded container (backgroundColor on a
        // RoundedTextbox); the text glyphs use the fixed warm ink.
        fill: BUBBLE_TEXT_FILL,
        backgroundColor: obj.fill,
        cornerRadius: obj.cornerRadius,
      }
    case 'emoji':
      return {
        ...common,
        text: obj.emoji,
        fontSize: obj.fontSize,
        fill: '#000000',
      }
    case 'shape':
      return {
        ...common,
        fill: obj.fill,
        stroke: obj.stroke,
        strokeWidth: obj.strokeWidth,
      }
  }
}

/** Extract schema-relevant props back from a fabric object (pure). */
export function fabricPropsToSchema(obj: {
  left: number
  top: number
  scaleX: number
  scaleY: number
  angle: number
  opacity: number
}): Pick<
  CanvasObject,
  'left' | 'top' | 'scaleX' | 'scaleY' | 'angle' | 'opacity'
> {
  return {
    left: obj.left,
    top: obj.top,
    scaleX: obj.scaleX,
    scaleY: obj.scaleY,
    angle: obj.angle,
    opacity: obj.opacity,
  }
}

export const SHAPE_PATH: Record<ShapeKind, string> = {
  circle: '', // fabric.Circle
  heart:
    'M 0 10 A 10 10 0 0 1 20 10 C 20 0 0 -10 0 -20 C 0 -10 -20 0 -20 10 A 10 10 0 0 1 0 10 Z',
  star: 'M 0 -20 L 6 -6 L 20 -6 L 9 3 L 13 18 L 0 9 L -13 18 L -9 3 L -20 -6 L -6 -6 Z',
}
