// Canvas size presets for the meme studio editor.

export interface CanvasSizePreset {
  id: 'square' | 'portrait' | 'wide' | 'custom'
  label: string
  width: number
  height: number
}

// Custom is intentionally NOT a preset here: it has no fixed size. The
// property panel renders it as a distinct button that reveals width/height
// number inputs, so a "自定义" click must never silently apply a size.
export const CANVAS_SIZE_PRESETS: CanvasSizePreset[] = [
  { id: 'square', label: '方形(朋友圈)', width: 1080, height: 1080 },
  { id: 'portrait', label: '竖图(小红书)', width: 1080, height: 1440 },
  { id: 'wide', label: '宽幅(横幅)', width: 1080, height: 608 },
]
