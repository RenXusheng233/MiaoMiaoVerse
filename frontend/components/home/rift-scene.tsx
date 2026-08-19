'use client'

import { useEffect, useRef } from 'react'
import { Mesh, Program, Renderer, Triangle } from 'ogl'

import styles from './home.module.css'

interface RiftSceneProps {
  isPaused: boolean
  onReady: () => void
  onUnavailable: () => void
}

export const RIFT_WEBGL_VERSION = 1
export const RIFT_UV_SCALE = 1

export function shouldRunRiftAnimation(
  isPaused: boolean,
  isVisible: boolean,
  isDocumentVisible: boolean,
) {
  return !isPaused && isVisible && isDocumentVisible
}

const vertex = /* glsl */ `
  attribute vec2 uv;
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`

const fragment = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform vec2 uResolution;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x), f.y);
  }
  void main() {
    vec2 p = vUv * ${RIFT_UV_SCALE.toFixed(1)} - 0.5;
    p.x *= uResolution.x / max(uResolution.y, 1.0);
    float angle = atan(p.y, p.x);
    float radius = length(p);
    float drift = noise(vec2(angle * 2.4 + uTime * 0.08, radius * 8.0));
    float halo = (1.0 - smoothstep(0.31, 0.54, radius)) * smoothstep(0.22, 0.34, radius);
    vec3 violet = vec3(0.49, 0.36, 1.0);
    vec3 pink = vec3(0.91, 0.42, 1.0);
    vec3 color = mix(violet, pink, drift) * halo * 0.42;
    float alpha = halo * 0.3;
    gl_FragColor = vec4(color, alpha);
  }
`

export function RiftScene({
  isPaused,
  onReady,
  onUnavailable,
}: RiftSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pausedRef = useRef(isPaused)
  const readyRef = useRef(onReady)
  const unavailableRef = useRef(onUnavailable)
  const animationControlRef = useRef<(paused: boolean) => void>(() => {})

  useEffect(() => {
    pausedRef.current = isPaused
    animationControlRef.current(isPaused)
  }, [isPaused])
  useEffect(() => {
    readyRef.current = onReady
  }, [onReady])
  useEffect(() => {
    unavailableRef.current = onUnavailable
  }, [onUnavailable])

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const desktop = window.matchMedia('(min-width: 768px)').matches
    const initialBounds = container.getBoundingClientRect()
    const initialWidth = Math.max(1, initialBounds.width)
    const initialHeight = Math.max(1, initialBounds.height)
    let renderer: Renderer | undefined
    let program: Program | undefined
    let mesh: Mesh | undefined
    try {
      renderer = new Renderer({
        canvas,
        width: initialWidth,
        height: initialHeight,
        alpha: true,
        antialias: false,
        depth: false,
        dpr: Math.min(window.devicePixelRatio, desktop ? 1.5 : 1.25),
        powerPreference: 'high-performance',
        webgl: RIFT_WEBGL_VERSION,
      })
      const gl = renderer.gl
      gl.clearColor(0, 0, 0, 0)
      const geometry = new Triangle(gl)
      program = new Program(gl, {
        vertex,
        fragment,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uResolution: { value: [initialWidth, initialHeight] },
        },
      })
      mesh = new Mesh(gl, { geometry, program })
    } catch {
      unavailableRef.current()
      return
    }
    if (!renderer || !program || !mesh) {
      unavailableRef.current()
      return
    }
    let frame = 0
    let elapsed = 0
    let previous = performance.now()
    let visible = true
    let documentVisible = !document.hidden

    const resize = () => {
      const { width, height } = container.getBoundingClientRect()
      const nextWidth = Math.max(1, width)
      const nextHeight = Math.max(1, height)
      renderer.setSize(nextWidth, nextHeight)
      program.uniforms.uResolution.value = [nextWidth, nextHeight]
    }
    let loopRunning = false
    let failed = false
    const stopLoop = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      loopRunning = false
    }
    const render = (now: number) => {
      if (
        !shouldRunRiftAnimation(pausedRef.current, visible, documentVisible)
      ) {
        stopLoop()
        return
      }
      const delta = Math.min(now - previous, 50)
      previous = now
      elapsed += delta
      program.uniforms.uTime.value = elapsed / 1000
      try {
        renderer.render({ scene: mesh })
      } catch {
        delete container.dataset.ready
        failed = true
        stopLoop()
        unavailableRef.current()
        return
      }
      frame = requestAnimationFrame(render)
    }
    const startLoop = () => {
      if (
        loopRunning ||
        !shouldRunRiftAnimation(pausedRef.current, visible, documentVisible)
      ) {
        return
      }
      previous = performance.now()
      loopRunning = true
      frame = requestAnimationFrame(render)
    }
    const syncLoop = () => {
      if (shouldRunRiftAnimation(pausedRef.current, visible, documentVisible)) {
        startLoop()
      } else {
        stopLoop()
      }
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting
        syncLoop()
      },
      { rootMargin: '120px' },
    )
    const handleVisibility = () => {
      documentVisible = !document.hidden
      syncLoop()
    }
    const handleContextLost = (event: Event) => {
      event.preventDefault()
      delete container.dataset.ready
      canvas.dataset.contextLost = 'true'
      if (failed) return
      failed = true
      stopLoop()
      unavailableRef.current()
    }

    animationControlRef.current = (paused) => {
      pausedRef.current = paused
      syncLoop()
    }

    resize()
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)
    observer.observe(container)
    document.addEventListener('visibilitychange', handleVisibility)
    canvas.addEventListener('webglcontextlost', handleContextLost)
    try {
      renderer.render({ scene: mesh })
    } catch {
      observer.disconnect()
      resizeObserver.disconnect()
      document.removeEventListener('visibilitychange', handleVisibility)
      canvas.removeEventListener('webglcontextlost', handleContextLost)
      unavailableRef.current()
      return
    }
    container.dataset.ready = 'true'
    readyRef.current()
    startLoop()

    return () => {
      delete container.dataset.ready
      animationControlRef.current = () => {}
      stopLoop()
      observer.disconnect()
      resizeObserver.disconnect()
      document.removeEventListener('visibilitychange', handleVisibility)
      canvas.removeEventListener('webglcontextlost', handleContextLost)
    }
  }, [])

  return (
    <div ref={containerRef} aria-hidden="true" className={styles['rift-scene']}>
      <canvas ref={canvasRef} className={styles['rift-scene__canvas']} />
    </div>
  )
}
