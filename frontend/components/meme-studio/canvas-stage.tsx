// Canvas stage — mounts the fabric canvas exactly once and exposes the
// FabricBridge to the workspace via bridgeRef. Empty-canvas clicks clear the
// selection; canvas size changes are pushed through bridge.setCanvasConfig.
//
// Layout strategy: a ResizeObserver on the container computes a scale factor
// so the canvas always fits without scrolling. A "shim" div (layout size =
// visual canvas size) gives the flex container an accurate centering target;
// the inner wrapper applies the CSS transform so Fabric's upper-canvas
// sibling is scaled together with the lower canvas, keeping pointer-event
// hit-testing correct at every zoom level.
'use client'

import { useEffect, useRef, useState } from 'react'
import { Canvas as FabricCanvas } from 'fabric'
import { FabricBridge } from '@/lib/meme-studio/fabric-bridge'
import type { MemeSchema } from '@/lib/meme-studio/schema'

import styles from './meme-studio.module.css'

interface CanvasStageProps {
  schema: MemeSchema
  bridgeRef: React.MutableRefObject<FabricBridge | null>
  onSchemaChange: (schema: MemeSchema) => void
  onSelectionChange: (id: string | null) => void
}

// Visual breathing room around the scaled canvas (px, total for both sides).
const STAGE_MARGIN = 32

export function CanvasStage({
  schema,
  bridgeRef,
  onSchemaChange,
  onSelectionChange,
}: CanvasStageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const initializedRef = useRef(false)
  const [scale, setScale] = useState(1)

  // Ref holds the latest canvas schema dimensions so the ResizeObserver
  // callback (closed over the first render) always reads fresh values.
  const canvasDimRef = useRef({
    w: schema.canvas.width,
    h: schema.canvas.height,
  })

  useEffect(() => {
    canvasDimRef.current = {
      w: schema.canvas.width,
      h: schema.canvas.height,
    }
  }, [schema.canvas.width, schema.canvas.height])

  useEffect(() => {
    if (initializedRef.current || !containerRef.current || !canvasRef.current)
      return
    initializedRef.current = true
    const canvas = new FabricCanvas(canvasRef.current, { selection: true })
    const bridge = new FabricBridge(canvas, schema, (s) => {
      onSchemaChange(s)
      onSelectionChange(bridge.getSelectedId())
    })
    bridgeRef.current = bridge
    // Clicking empty canvas space clears the current selection
    canvas.on('mouse:down', (e) => {
      if (!e.target) {
        canvas.discardActiveObject()
        canvas.renderAll()
        onSelectionChange(null)
      }
    })
    return () => {
      canvas.dispose()
      initializedRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Rebuild when canvas size or background changes (driven by the property panel)
  useEffect(() => {
    bridgeRef.current?.setCanvasConfig({
      width: schema.canvas.width,
      height: schema.canvas.height,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema.canvas.width, schema.canvas.height])

  // Compute scale-to-fit: largest factor ≤ 1 that fits the canvas in the
  // available area with STAGE_MARGIN breathing room on each axis.
  function computeScale(containerW: number, containerH: number): number {
    const aw = containerW - STAGE_MARGIN
    const ah = containerH - STAGE_MARGIN
    if (aw <= 0 || ah <= 0) return 1
    return Math.max(
      0.05,
      Math.min(aw / canvasDimRef.current.w, ah / canvasDimRef.current.h, 1),
    )
  }

  // Watch container resize — set up once, always reads fresh dims via ref.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    setScale(computeScale(el.clientWidth, el.clientHeight))
    const ro = new ResizeObserver(([entry]) => {
      setScale(computeScale(entry.contentRect.width, entry.contentRect.height))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Recompute when the canvas schema dimensions change (preset switch, custom size).
  useEffect(() => {
    const el = containerRef.current
    if (el) setScale(computeScale(el.clientWidth, el.clientHeight))
  }, [schema.canvas.width, schema.canvas.height])

  const { width: cw, height: ch } = schema.canvas

  return (
    <div
      ref={containerRef}
      className={styles['studio-stage']}
    >
      {schema.objects.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className={styles['studio-stage__empty']}>
            从左侧添加组件开始创作
          </p>
        </div>
      ) : null}
      {/*
       * Shim: layout size = visual canvas size (cw*scale × ch*scale).
       * The flex container centers this element; without it, flex would center
       * the full-resolution inner wrapper and overflow past the scroll origin,
       * making the top permanently unreachable.
       */}
      <div
        style={{
          width: cw * scale,
          height: ch * scale,
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        {/*
         * Inner wrapper at full canvas resolution, scaled by CSS transform.
         * Applying the transform here (not on the <canvas> element) means
         * Fabric's upper-canvas sibling inherits the same scale, so
         * getBoundingClientRect() returns visual bounds and pointer-event
         * coordinates map correctly without any manual adjustment.
         */}
        <div
          style={{
            width: cw,
            height: ch,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          <canvas
            ref={canvasRef}
            style={{ borderRadius: `${schema.canvas.cornerRadius}px` }}
          />
        </div>
      </div>
    </div>
  )
}
