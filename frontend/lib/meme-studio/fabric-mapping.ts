// Pure functions mapping between MemeStudio schema objects and fabric.js
// constructor options — no fabric imports here, so these are fully testable.
import type { CanvasObject, ShapeKind } from './schema'

/**
 * Fixed ink color for bubble text. The bubble's schema `fill` IS the
 * container color (rendered as the text background), so text needs its own
 * high-contrast color rather than the pastel preset fill.
 */
export const BUBBLE_TEXT_FILL = '#4A3728'

/**
 * Fold an alpha value into a hex color as an rgba() string, so colors can go
 * transparent wherever fabric paints (2d fillStyle). Solid colors pass
 * through unchanged to keep the export bytes minimal.
 */
export function fillWithOpacity(fill: string, opacity: number): string {
  if (opacity >= 1) return fill
  const hex = fill.replace('#', '')
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex
  const n = parseInt(full, 16)
  if (Number.isNaN(n)) return fill // not a hex color — pass through
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${opacity})`
}

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
        // RoundedTextbox); the text glyphs use the fixed warm ink. fillOpacity
        // is folded into an rgba() string so the container can go transparent.
        // The border maps to custom bubbleBorder/bubbleBorderWidth props —
        // fabric's stroke would outline the text glyphs instead of the
        // container (and FabricObject already owns borderColor).
        fill: BUBBLE_TEXT_FILL,
        backgroundColor: fillWithOpacity(obj.fill, obj.fillOpacity),
        bubbleBorder: obj.stroke,
        bubbleBorderWidth: obj.strokeWidth,
        paddingX: obj.paddingX,
        paddingY: obj.paddingY,
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
        fill: fillWithOpacity(obj.fill, obj.fillOpacity),
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

// All paths are centered on the origin and sized to a ~160px visual extent,
// matching the circle's 160px diameter (radius 80) so every shape starts at
// the same on-canvas size.
export const SHAPE_PATH: Record<ShapeKind, string> = {
  circle: '', // fabric.Circle
  // Upright heart (point at the bottom) — the previous path was upside down,
  // which is why the canvas shape never matched the ♥ palette icon.
  heart:
    'M 56 16 C 68 6 80 -10 80 -28 C 80 -55 62 -72 36 -72 C 22 -72 12 -68 0 -56 C -12 -68 -22 -72 -36 -72 C -62 -72 -80 -55 -80 -28 C -80 -10 -68 6 -56 16 L 0 72 Z',
  star: 'M 0 -80 L 24 -24 L 80 -24 L 36 12 L 52 72 L 0 36 L -52 72 L -36 12 L -80 -24 L -24 -24 Z',
  square: 'M -80 -80 L 80 -80 L 80 80 L -80 80 Z',
  triangle: 'M 0 -80 L 80 62 L -80 62 Z',
  diamond: 'M 0 -80 L 80 0 L 0 80 L -80 0 Z',
}
