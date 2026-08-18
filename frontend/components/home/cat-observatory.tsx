'use client'

import Image from 'next/image'
import { motion, useReducedMotion } from 'motion/react'

import type { CatBreed } from '@/lib/types/cat'

interface CatObservatoryProps {
  cat: CatBreed
}

const EYE_CLIP_PATH =
  'polygon(0 50%, 10% 28%, 28% 14%, 50% 9%, 72% 14%, 90% 28%, 100% 50%, 90% 72%, 72% 86%, 50% 91%, 28% 86%, 10% 72%)'

export function CatObservatory({ cat }: CatObservatoryProps) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <article
      aria-label={`${cat.name_zh}猫眼观测窗`}
      className="relative mx-auto w-full max-w-170"
    >
      <div className="relative aspect-[7/5] w-full">
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 700 500"
          className="pointer-events-none absolute inset-0 size-full overflow-visible text-grid-line"
        >
          <ellipse
            cx="350"
            cy="250"
            rx="318"
            ry="208"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="4 12"
          />
          <ellipse
            cx="350"
            cy="250"
            rx="278"
            ry="174"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          />
          <path
            d="M210 294C151 330 89 336 34 306M218 318C151 371 90 382 46 368M490 294C549 330 611 336 666 306M482 318C549 371 610 382 654 368"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>

        <div
          className="absolute inset-x-[11%] inset-y-[14%] overflow-hidden bg-surface-strong shadow-panel"
          style={{ clipPath: EYE_CLIP_PATH }}
        >
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.96 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1, scale: 1 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            className="relative size-full"
          >
            <Image
              src={cat.image_url}
              alt={`${cat.name_zh}（${cat.name_en}）`}
              fill
              sizes="(max-width: 1023px) 86vw, 48vw"
              className="object-cover"
              preload
            />
          </motion.div>

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-signal/10"
          />

          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-[-28%] text-signal"
            animate={shouldReduceMotion ? undefined : { rotate: 360 }}
            transition={{ duration: 18, ease: 'linear', repeat: Infinity }}
          >
            <svg
              aria-hidden="true"
              focusable="false"
              viewBox="0 0 700 500"
              className="size-full"
            >
              <path
                d="M106 250C147 112 259 42 350 42"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </svg>
          </motion.div>
        </div>

        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 700 500"
          className="pointer-events-none absolute inset-0 size-full text-foreground"
        >
          <path
            d="M42 250C136 94 243 62 350 62S564 94 658 250C564 406 457 438 350 438S136 406 42 250Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            d="M65 250C150 119 253 91 350 91S550 119 635 250C550 381 447 409 350 409S150 381 65 250Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.45"
          />
        </svg>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-[8%] top-[22%] size-1.5 rounded-full bg-signal shadow-[0_0_18px_var(--glow)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-[12%] top-[15%] size-1 rounded-full bg-signal-secondary"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-[18%] right-[4%] size-1.5 rounded-full bg-primary"
        />
      </div>

      <div className="relative z-10 -mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-grid-line bg-grid-line shadow-panel sm:grid-cols-[1.5fr_1fr_1fr]">
        <div className="col-span-2 bg-surface px-4 py-3 sm:col-span-1 sm:px-5">
          <p className="font-heading text-xl font-semibold text-foreground sm:text-2xl">
            {cat.name_zh}
          </p>
          <p className="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">
            {cat.name_en}
          </p>
        </div>
        <dl className="contents">
          <div className="bg-surface px-4 py-3 sm:px-5">
            <dt className="font-mono text-[0.65rem] tracking-[0.18em] text-muted-foreground uppercase">
              Origin
            </dt>
            <dd className="mt-1 text-sm font-medium text-foreground">
              {cat.origin}
            </dd>
          </div>
          <div className="bg-surface px-4 py-3 sm:px-5">
            <dt className="font-mono text-[0.65rem] tracking-[0.18em] text-muted-foreground uppercase">
              Size
            </dt>
            <dd className="mt-1 text-sm font-medium text-foreground">
              {cat.size}
            </dd>
          </div>
        </dl>
      </div>
    </article>
  )
}
