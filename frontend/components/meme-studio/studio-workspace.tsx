// Studio workspace — the three-panel editor shell: palette (left), canvas
// (center), property panel (right). The schema lives here as the single
// source of truth; all mutations flow through the FabricBridge, which pushes
// the updated schema back through onSchemaChange to re-render the panels.
'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { CanvasStage } from '@/components/meme-studio/canvas-stage'
import { ComponentPalette } from '@/components/meme-studio/component-palette'
import { PropertyPanel } from '@/components/meme-studio/property-panel'
import { FabricBridge } from '@/lib/meme-studio/fabric-bridge'
import type {
  CanvasConfig,
  CanvasObject,
  MemeSchema,
} from '@/lib/meme-studio/schema'

const DEFAULT_SCHEMA: MemeSchema = {
  canvas: {
    width: 1080,
    height: 1080,
    backgroundMode: 'color',
    backgroundColor: '#FFFFFF',
    gradient: null,
    backgroundImage: null,
    cornerRadius: 0,
  },
  objects: [],
}

export function StudioWorkspace() {
  const [schema, setSchema] = useState<MemeSchema>(DEFAULT_SCHEMA)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const bridgeRef = useRef<FabricBridge | null>(null)

  function handleAdd(obj: CanvasObject) {
    const id = bridgeRef.current?.addObject(obj)
    if (id) setSelectedId(id)
  }

  function handleCanvasChange(patch: Partial<CanvasConfig>) {
    bridgeRef.current?.setCanvasConfig(patch)
  }

  function handleObjectChange(id: string, patch: Partial<CanvasObject>) {
    bridgeRef.current?.updateObject(id, patch)
  }

  function handleDelete() {
    if (!selectedId) return
    bridgeRef.current?.removeObject(selectedId)
    setSelectedId(null)
  }

  async function handleExport() {
    if (isExporting) return // no parallel exports from double clicks
    setIsExporting(true)
    try {
      const dataUrl = await bridgeRef.current?.toDataURL()
      if (!dataUrl) return
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = 'meme.png'
      a.click()
    } catch {
      alert('导出失败，请重试')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col">
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← 返回首页
          </Link>
          <h1 className="font-heading text-xl text-foreground">表情包工作室</h1>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleDelete}
            disabled={!selectedId}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:border-destructive hover:text-destructive disabled:opacity-40"
          >
            删除选中
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {isExporting ? '导出中…' : '导出 PNG'}
          </button>
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <ComponentPalette onAdd={handleAdd} />
        <CanvasStage
          schema={schema}
          bridgeRef={bridgeRef}
          onSchemaChange={setSchema}
          onSelectionChange={setSelectedId}
        />
        <PropertyPanel
          schema={schema}
          selectedId={selectedId}
          onCanvasChange={handleCanvasChange}
          onObjectChange={handleObjectChange}
        />
      </div>
    </div>
  )
}
