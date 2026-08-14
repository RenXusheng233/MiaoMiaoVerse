// FabricBridge — the only place where fabric.js objects and MemeSchema meet.
// Owns bidirectional sync: schema → canvas (renderAll / add / update / remove /
// setCanvasConfig) and canvas → schema (object:modified / selection events),
// pushing a deep copy of the schema through onChange on every mutation.
//
// fabric v7 adaptations vs the task brief (which assumed a v6-style API):
// - v7 has NO `fabric` namespace export — everything is a named import, so
//   `fabric.Canvas` / `fabric.Textbox` / ... become `Canvas` / `Textbox` / ...
// - `fabric.Object` was renamed `FabricObject`; `fabric.Image` → `FabricImage`.
// - `FabricImage.fromURL(url)` returns a Promise instead of taking a callback.
// - option types are `TextboxProps` / `CircleProps` / `PathProps`, not
//   `ITextboxOptions` / `ICircleOptions` / `IPathOptions`.
// - `canvas.backgroundColor` accepts a `Gradient` directly (TFiller), so the
//   brief's `as unknown as string` cast is no longer needed.
import {
  Canvas as FabricCanvas,
  Circle,
  FabricImage,
  Gradient,
  Path,
  Textbox,
} from 'fabric'
import type { CircleProps, FabricObject, PathProps, TextboxProps } from 'fabric'
import type { CanvasConfig, CanvasObject, MemeSchema } from './schema'
import {
  SHAPE_PATH,
  fabricPropsToSchema,
  schemaToFabricOptions,
} from './fabric-mapping'

/** Fixed visual size for circle shapes — the schema has no radius field. */
const DEFAULT_CIRCLE_RADIUS = 80

/**
 * Textbox that paints its backgroundColor as a ROUNDED rect. fabric's
 * Textbox only supports a plain fillRect background (IText._renderBackground)
 * and has no usable `cornerRadius`, so this override gives bubbles their
 * container look. Radius is clamped to half the box so tiny bubbles stay sane.
 */
class RoundedTextbox extends Textbox {
  /** Bubble corner radius — written via set() from schemaToFabricOptions. */
  declare cornerRadius?: number

  // `cornerRadius` is not a registered fabric prop (no dirty-marking in
  // _set), but the override reads it every draw — register it so slider
  // changes on bubbles invalidate the bitmap cache and repaint.
  static override get cacheProperties(): string[] {
    return [...super.cacheProperties, 'cornerRadius']
  }

  override _renderBackground(ctx: CanvasRenderingContext2D): void {
    if (!this.backgroundColor) return
    const dim = this._getNonTransformedDimensions()
    const r = Math.min(this.cornerRadius ?? 0, dim.x / 2, dim.y / 2)
    ctx.fillStyle = this.backgroundColor
    ctx.beginPath()
    if (ctx.roundRect) {
      ctx.roundRect(-dim.x / 2, -dim.y / 2, dim.x, dim.y, r)
    } else {
      // Fallback for browsers without roundRect (Safari < 16).
      const x = -dim.x / 2
      const y = -dim.y / 2
      ctx.moveTo(x + r, y)
      ctx.arcTo(x + dim.x, y, x + dim.x, y + dim.y, r)
      ctx.arcTo(x + dim.x, y + dim.y, x, y + dim.y, r)
      ctx.arcTo(x, y + dim.y, x, y, r)
      ctx.arcTo(x, y, x + dim.x, y, r)
      ctx.closePath()
    }
    ctx.fill()
  }
}

export class FabricBridge {
  private readonly canvas: FabricCanvas
  private schema: MemeSchema
  private readonly onChange: (schema: MemeSchema) => void
  /** Monotonic counter that discards stale background-image loads. */
  private backgroundLoadSeq = 0

  constructor(
    canvas: FabricCanvas,
    initial: MemeSchema,
    onChange: (schema: MemeSchema) => void,
  ) {
    this.canvas = canvas
    this.schema = JSON.parse(JSON.stringify(initial))
    this.onChange = onChange
    this.bindEvents()
    this.renderAll()
  }

  private bindEvents() {
    this.canvas.on('selection:created', () => this.emit())
    this.canvas.on('selection:cleared', () => this.emit())
    // Covers moves/resizes/rotates AND text edits — IText fires
    // object:modified when editing exits with changes (ITextBehavior).
    this.canvas.on('object:modified', (e) => this.syncFromFabric(e.target))
  }

  /**
   * Write canvas-side mutations back into the schema: geometry via
   * fabricPropsToSchema, plus the edited text for text-like objects.
   */
  private syncFromFabric(target: FabricObject | undefined) {
    if (!target) return
    const id = target.get('customId') as string | undefined
    if (!id) return
    const obj = this.schema.objects.find((o) => o.id === id)
    if (!obj) return
    Object.assign(obj, fabricPropsToSchema(target))
    // The instance reports its class name ('textbox'); accept legacy
    // spellings ('text', 'i-text') defensively.
    if (
      target.type === 'text' ||
      target.type === 'textbox' ||
      target.type === 'i-text'
    ) {
      const text = (target as Textbox).text ?? ''
      // Write back by schema type — shape objects have no text field and can
      // never be textboxes, so they are unreachable here.
      if (obj.type === 'text' || obj.type === 'bubble') {
        obj.text = text
      } else if (obj.type === 'emoji') {
        obj.emoji = text
      }
    }
    this.emit()
  }

  /** Push a deep copy of the schema to the subscriber. */
  private emit() {
    this.onChange(JSON.parse(JSON.stringify(this.schema)))
  }

  /** (Re)render the whole canvas from the current schema. */
  renderAll() {
    this.canvas.clear()
    this.applyCanvasConfig(this.schema.canvas)
    for (const obj of this.schema.objects) {
      this.canvas.add(this.createFabricObject(obj))
    }
    this.canvas.renderAll()
  }

  private applyCanvasConfig(cfg: CanvasConfig) {
    this.canvas.setDimensions({ width: cfg.width, height: cfg.height })
    if (cfg.backgroundMode === 'image' && cfg.backgroundImage) {
      // v7: Promise-based load (no callback) — ignore stale resolutions so a
      // slow older image never overwrites a newer background.
      const loadSeq = ++this.backgroundLoadSeq
      FabricImage.fromURL(cfg.backgroundImage)
        .then((img) => {
          if (loadSeq !== this.backgroundLoadSeq) return
          img.scaleToWidth(cfg.width)
          this.canvas.backgroundImage = img
          this.canvas.renderAll()
        })
        .catch(() => undefined) // unreadable URL: keep the previous background
    } else if (cfg.backgroundMode === 'gradient' && cfg.gradient) {
      const grad = new Gradient({
        type: 'linear',
        coords: { x1: 0, y1: 0, x2: cfg.width, y2: cfg.height },
        colorStops: [
          { offset: 0, color: cfg.gradient.from },
          { offset: 1, color: cfg.gradient.to },
        ],
      })
      this.canvas.backgroundColor = grad
    } else {
      this.canvas.backgroundColor = cfg.backgroundColor
    }
    this.canvas.renderAll()
  }

  private createFabricObject(obj: CanvasObject): FabricObject {
    const options = schemaToFabricOptions(obj)
    let fobj: FabricObject
    if (obj.type === 'shape' && obj.shape !== 'circle') {
      // heart / star are SVG paths; circle has its own fabric class.
      fobj = new Path(SHAPE_PATH[obj.shape], options as Partial<PathProps>)
    } else if (obj.type === 'shape') {
      fobj = new Circle({
        ...options,
        radius: DEFAULT_CIRCLE_RADIUS,
      } as Partial<CircleProps>)
    } else if (obj.type === 'bubble') {
      // Bubbles are rounded containers: RoundedTextbox paints the preset
      // fill (mapped to backgroundColor) as a rounded rect behind the text.
      fobj = new RoundedTextbox(obj.text, options as Partial<TextboxProps>)
    } else {
      fobj = new Textbox(obj.type === 'emoji' ? obj.emoji : obj.text, {
        ...options,
        // Emoji are stickers — disable double-click text editing on them.
        ...(obj.type === 'emoji' ? { editable: false } : {}),
      } as Partial<TextboxProps>)
    }
    fobj.set({ customId: obj.id })
    return fobj
  }

  addObject(obj: CanvasObject): string {
    // Build the fabric object FIRST: if construction throws, neither the
    // schema nor the canvas diverges (no phantom schema-only objects).
    const fobj = this.createFabricObject(obj)
    this.schema.objects.push(obj)
    this.canvas.add(fobj)
    this.canvas.setActiveObject(fobj)
    this.emit()
    this.canvas.renderAll()
    return obj.id
  }

  updateObject(id: string, patch: Partial<CanvasObject>): void {
    const idx = this.schema.objects.findIndex((o) => o.id === id)
    if (idx === -1) return
    Object.assign(this.schema.objects[idx], patch)
    const fobj = this.findObject(id)
    if (fobj) {
      // Re-derive the FULL mapped options and apply through set(). fabric 7
      // declares its props as class fields that shadow the property
      // accessors, so a bare Object.assign writes plain data properties and
      // skips _set — the bitmap cache stays stale and the change only shows
      // after the object is next interacted with. set() marks the cache
      // dirty for every cache-relevant key, so ALL panel edits (stroke,
      // strokeWidth, backgroundColor, …) reach the canvas immediately.
      fobj.set(schemaToFabricOptions(this.schema.objects[idx]) as never)
      this.canvas.renderAll()
    }
    this.emit()
  }

  removeObject(id: string): void {
    this.schema.objects = this.schema.objects.filter((o) => o.id !== id)
    const fobj = this.findObject(id)
    if (fobj) this.canvas.remove(fobj)
    this.emit()
    this.canvas.renderAll()
  }

  setCanvasConfig(patch: Partial<CanvasConfig>): void {
    Object.assign(this.schema.canvas, patch)
    this.applyCanvasConfig(this.schema.canvas)
    this.emit()
  }

  selectObject(id: string | null): void {
    if (!id) {
      this.canvas.discardActiveObject()
    } else {
      const fobj = this.findObject(id)
      if (fobj) this.canvas.setActiveObject(fobj)
    }
    this.canvas.renderAll()
    this.emit()
  }

  getSelectedId(): string | null {
    const active = this.canvas.getActiveObject()
    // v7 getActiveObject returns undefined (not null) when nothing is selected.
    return active
      ? ((active.get('customId') as string | undefined) ?? null)
      : null
  }

  /**
   * Export the canvas as a PNG data URL. Rounded corners are applied AFTER
   * the export via a temp canvas (destination-in), NOT via canvas.clipPath:
   * fabric 7 caches the clipPath against the live canvas's retina/backing
   * resolution, and toDataURL reuses that stale cache on a differently-scaled
   * output canvas — the rounded clip silently covers only part of the export
   * (observed as a top-left quadrant of the image). Post-processing the PNG is
   * resolution-independent and has no interplay with fabric's cache.
   */
  async toDataURL(): Promise<string> {
    // Discard the selection first so the exported PNG has no control outline.
    this.canvas.discardActiveObject()
    this.canvas.renderAll()
    const url = this.canvas.toDataURL({ format: 'png', multiplier: 1 })
    const radius = this.schema.canvas.cornerRadius
    return radius > 0 ? clipRoundedCorners(url, radius) : url
  }

  getSchema(): MemeSchema {
    return JSON.parse(JSON.stringify(this.schema))
  }

  /** Find a canvas object by its schema id (stored as customId). */
  private findObject(id: string): FabricObject | undefined {
    return this.canvas.getObjects().find((o) => o.get('customId') === id)
  }
}

/**
 * Re-encode an exported PNG with transparent rounded corners by drawing it
 * onto a temp canvas and erasing everything outside a rounded rect
 * (destination-in). The image is a same-origin data URL, so no taint issues.
 */
function clipRoundedCorners(dataUrl: string, radius: number): Promise<string> {
  return new Promise((resolve, reject) => {
    // window.Image — the bare `Image` name is not shadowed here, but qualify
    // it to match the repo precedent (see daily-cat-widget.tsx).
    const img = new window.Image()
    img.onload = () => {
      const el = document.createElement('canvas')
      el.width = img.width
      el.height = img.height
      const ctx = el.getContext('2d')
      if (!ctx) {
        reject(new Error('2d context unavailable'))
        return
      }
      ctx.drawImage(img, 0, 0)
      ctx.globalCompositeOperation = 'destination-in'
      ctx.beginPath()
      if (ctx.roundRect) {
        ctx.roundRect(0, 0, el.width, el.height, radius)
      } else {
        // Fallback for browsers without roundRect (Safari < 16).
        const r = radius
        ctx.moveTo(r, 0)
        ctx.arcTo(el.width, 0, el.width, el.height, r)
        ctx.arcTo(el.width, el.height, 0, el.height, r)
        ctx.arcTo(0, el.height, 0, 0, r)
        ctx.arcTo(0, 0, el.width, 0, r)
        ctx.closePath()
      }
      ctx.fill()
      resolve(el.toDataURL('image/png'))
    }
    img.onerror = () => reject(new Error('exported image failed to decode'))
    img.src = dataUrl
  })
}
