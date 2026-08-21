// Studio workspace — the three-panel editor shell: palette (left), canvas
// (center), property panel (right). The schema lives here as the single
// source of truth; all mutations flow through the FabricBridge, which pushes
// the updated schema back through onSchemaChange to re-render the panels.
'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, Trash2 } from 'lucide-react'
import { CanvasStage } from '@/components/meme-studio/canvas-stage'
import { ComponentPalette } from '@/components/meme-studio/component-palette'
import { PropertyPanel } from '@/components/meme-studio/property-panel'
import { FabricBridge } from '@/lib/meme-studio/fabric-bridge'
import type {
  CanvasConfig,
  CanvasObject,
  MemeSchema,
} from '@/lib/meme-studio/schema'
import { cn } from '@/lib/utils'

import { CosmicBackground } from '@/components/shared/cosmic-background'

import styles from './meme-studio.module.css'

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
    <div className={styles['studio-shell']}>
      <CosmicBackground />

      <header className={styles['studio-header']}>
        <div className={styles['studio-header__identity']}>
          <Link href="/" className={styles['studio-header__back']}>
            <ArrowLeft aria-hidden="true" />
            返回首页
          </Link>
          <div className={styles['studio-header__heading']}>
            <p className={styles['studio-header__eyebrow']}>MEME STUDIO</p>
            <h1 className={styles['studio-header__title']}>
              表情包<span>工作室</span>
            </h1>
          </div>
        </div>

        <div className={styles['studio-header__actions']}>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!selectedId}
            className={cn(
              styles['studio-action'],
              styles['studio-action--danger'],
            )}
          >
            <Trash2 aria-hidden="true" />
            <span>删除选中</span>
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className={cn(
              styles['studio-action'],
              styles['studio-action--primary'],
            )}
          >
            <Download aria-hidden="true" />
            <span>{isExporting ? '导出中…' : '导出 PNG'}</span>
          </button>
        </div>
      </header>

      <div className={styles['studio-body']}>
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
