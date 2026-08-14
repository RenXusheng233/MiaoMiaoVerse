// Canvas stage — mounts the fabric canvas exactly once and exposes the
// FabricBridge to the workspace via bridgeRef. Empty-canvas clicks clear the
// selection; canvas size changes are pushed through bridge.setCanvasConfig.
'use client'

import { useEffect, useRef } from 'react'
import { Canvas as FabricCanvas } from 'fabric'
import { FabricBridge } from '@/lib/meme-studio/fabric-bridge'
import type { MemeSchema } from '@/lib/meme-studio/schema'

interface CanvasStageProps {
  schema: MemeSchema
  bridgeRef: React.MutableRefObject<FabricBridge | null>
  onSchemaChange: (schema: MemeSchema) => void
  onSelectionChange: (id: string | null) => void
}

export function CanvasStage({
  schema,
  bridgeRef,
  onSchemaChange,
  onSelectionChange,
}: CanvasStageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const initializedRef = useRef(false)

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

  return (
    <div
      ref={containerRef}
      className="relative flex flex-1 items-center justify-center overflow-auto bg-muted/40 p-6"
    >
      {schema.objects.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">
            从左侧添加组件开始创作
          </p>
        </div>
      ) : null}
      <canvas
        ref={canvasRef}
        style={{ borderRadius: `${schema.canvas.cornerRadius}px` }}
      />
    </div>
  )
}
