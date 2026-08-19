'use client'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import { Pause, Play, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'

import type { CatBreed } from '@/lib/types/cat'
import { cn } from '@/lib/utils'

const RiftScene = dynamic(
  () => import('./rift-scene').then((module) => module.RiftScene),
  { ssr: false },
)

interface VersePortalProps {
  cat: CatBreed
  className?: string
}

interface NetworkInformationWithSaveData {
  saveData?: boolean
}

export function shouldAllowPortalInteraction(
  isPaused: boolean,
  shouldReduceMotion: boolean | null,
) {
  return !isPaused && !shouldReduceMotion
}

export function VersePortal({ cat, className }: VersePortalProps) {
  const shouldReduceMotion = useReducedMotion()
  const [isPaused, setIsPaused] = useState(false)
  const [isSceneReady, setIsSceneReady] = useState(false)
  const [useStaticScene, setUseStaticScene] = useState(true)
  const [imageFailed, setImageFailed] = useState(false)
  const [pulse, setPulse] = useState(0)
  const stageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const connection = (
        navigator as Navigator & { connection?: NetworkInformationWithSaveData }
      ).connection
      setUseStaticScene(
        Boolean(shouldReduceMotion) || connection?.saveData === true,
      )
    })

    return () => cancelAnimationFrame(frame)
  }, [shouldReduceMotion])

  const animationState = isPaused ? 'paused' : 'running'
  const allowPortalInteraction = shouldAllowPortalInteraction(
    isPaused,
    shouldReduceMotion,
  )

  useEffect(() => {
    if (!allowPortalInteraction) {
      const stage = stageRef.current
      stage?.style.setProperty('--rift-tilt-x', '0deg')
      stage?.style.setProperty('--rift-tilt-y', '0deg')
    }
  }, [allowPortalInteraction])

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!allowPortalInteraction || event.pointerType === 'touch') return
    const stage = stageRef.current
    if (!stage) return
    const bounds = stage.getBoundingClientRect()
    const tiltX = ((event.clientY - bounds.top) / bounds.height - 0.5) * -6
    const tiltY = ((event.clientX - bounds.left) / bounds.width - 0.5) * 6
    stage.style.setProperty('--rift-tilt-x', `${tiltX.toFixed(2)}deg`)
    stage.style.setProperty('--rift-tilt-y', `${tiltY.toFixed(2)}deg`)
  }

  function resetPointerTilt() {
    const stage = stageRef.current
    if (!stage) return
    stage.style.setProperty('--rift-tilt-x', '0deg')
    stage.style.setProperty('--rift-tilt-y', '0deg')
  }

  return (
    <article
      aria-label={`${cat.name_zh}全息星门`}
      className={cn('verse-portal', className)}
      onPointerDown={() => {
        if (allowPortalInteraction) setPulse((value) => value + 1)
      }}
    >
      <div
        ref={stageRef}
        className="verse-portal__stage"
        onPointerMove={handlePointerMove}
        onPointerLeave={resetPointerTilt}
      >
        <div
          data-rift-fallback="true"
          aria-hidden="true"
          className={cn(
            'verse-portal__fallback',
            isSceneReady &&
              !useStaticScene &&
              'verse-portal__fallback--enhanced',
          )}
        >
          <div
            className="verse-portal__ring verse-portal__ring--outer"
            style={{ animationPlayState: animationState }}
          />
          <div
            className="verse-portal__ring verse-portal__ring--inner"
            style={{ animationPlayState: animationState }}
          />
          <div className="verse-portal__halo" />
        </div>

        {!useStaticScene ? (
          <RiftScene
            isPaused={isPaused}
            onReady={() => setIsSceneReady(true)}
            onUnavailable={() => {
              setUseStaticScene(true)
              setIsSceneReady(false)
            }}
          />
        ) : null}

        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.82 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.72, duration: 0.52, ease: 'easeOut' }}
          className="cat-orb"
          style={{ animationPlayState: animationState }}
        >
          {imageFailed ? (
            <div
              className="cat-orb__fallback"
              role="img"
              aria-label={cat.name_zh}
            >
              <Sparkles aria-hidden="true" className="size-10" />
              <span>CAT / SIGNAL</span>
            </div>
          ) : (
            <Image
              src={cat.image_url}
              alt={`${cat.name_zh}（${cat.name_en}）`}
              fill
              sizes="(max-width: 767px) 58vw, (max-width: 1279px) 38vw, 28vw"
              className="cat-orb__image"
              onError={() => setImageFailed(true)}
              preload
            />
          )}
          <div aria-hidden="true" className="cat-orb__shade" />
          <div
            aria-hidden="true"
            className="cat-orb__scan"
            style={{ animationPlayState: animationState }}
          />
          <div
            aria-hidden="true"
            className="cat-orb__latitude"
            style={{ animationPlayState: animationState }}
          />
        </motion.div>

        {pulse > 0 ? (
          <span
            key={pulse}
            aria-hidden="true"
            className="verse-portal__pulse"
          />
        ) : null}
        <div
          aria-hidden="true"
          className="verse-portal__satellite verse-portal__satellite--one"
        />
        <div
          aria-hidden="true"
          className="verse-portal__satellite verse-portal__satellite--two"
        />

        <button
          type="button"
          aria-label={isPaused ? '恢复环境动效' : '暂停环境动效'}
          aria-pressed={isPaused}
          onClick={(event) => {
            event.stopPropagation()
            setIsPaused((paused) => !paused)
          }}
          className="verse-portal__control"
        >
          {isPaused ? (
            <Play aria-hidden="true" className="size-3.5" />
          ) : (
            <Pause aria-hidden="true" className="size-3.5" />
          )}
        </button>
      </div>

      <div className="hologram-dossier">
        <div className="hologram-dossier__identity">
          <p>{cat.name_zh}</p>
          <span>{cat.name_en}</span>
        </div>
        <dl>
          <div>
            <dt>Origin</dt>
            <dd>{cat.origin}</dd>
          </div>
          <div>
            <dt>Size</dt>
            <dd>{cat.size}</dd>
          </div>
        </dl>
      </div>
    </article>
  )
}
