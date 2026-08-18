'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { ArrowDown, BookOpen } from 'lucide-react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'

import { CatObservatory } from '@/components/home/cat-observatory'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { CatBreed } from '@/lib/types/cat'

interface HeroSectionProps {
  cat: CatBreed
}

export function HeroSection({ cat }: HeroSectionProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const shouldReduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  })

  const textY = useTransform(scrollYProgress, [0, 1], [0, -56])
  const orbitY = useTransform(scrollYProgress, [0, 1], [0, -96])
  const catY = useTransform(scrollYProgress, [0, 1], [0, -144])
  const catOpacity = useTransform(scrollYProgress, [0, 0.82], [1, 0])

  return (
    <section
      ref={sectionRef}
      aria-labelledby="home-hero-title"
      className="relative w-full overflow-hidden border-b border-grid-line bg-background lg:min-h-180"
    >
      <motion.div
        aria-hidden="true"
        style={{ y: shouldReduceMotion ? 0 : orbitY }}
        className="pointer-events-none absolute -right-44 top-12 hidden size-180 text-grid-line lg:block"
      >
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 720 720"
          className="size-full"
        >
          <circle
            cx="360"
            cy="360"
            r="302"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="5 16"
          />
          <circle
            cx="360"
            cy="360"
            r="238"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          />
          <path
            d="M82 468C191 570 296 611 434 596C532 586 607 544 662 478"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      </motion.div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[7%] top-[16%] size-1.5 rounded-full bg-signal shadow-[0_0_18px_var(--glow)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[43%] top-[12%] size-1 rounded-full bg-signal-secondary"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[17%] left-[48%] size-1.5 rounded-full bg-primary"
      />

      <div className="relative z-10 mx-auto grid w-full max-w-360 grid-cols-1 items-center gap-14 px-5 py-24 sm:px-8 lg:min-h-180 lg:grid-cols-[minmax(0,0.84fr)_minmax(0,1.16fr)] lg:gap-8 lg:px-12 lg:py-20 xl:gap-16">
        <motion.div style={{ y: shouldReduceMotion ? 0 : textY }}>
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="flex max-w-152 flex-col items-start"
          >
            <p className="mb-7 inline-flex items-center gap-3 rounded-full border border-grid-line bg-surface px-4 py-2 font-mono text-[0.68rem] font-medium tracking-[0.2em] text-muted-foreground uppercase shadow-panel">
              <span
                aria-hidden="true"
                className="size-2 rounded-full bg-signal shadow-[0_0_14px_var(--glow)]"
              />
              Feline observatory · MMV-01
            </p>
            <h1
              id="home-hero-title"
              className="font-heading text-[clamp(2.75rem,7vw,5.75rem)] leading-[0.94] font-semibold tracking-[-0.055em] text-foreground"
            >
              <span className="block">喵喵宇宙</span>
              <span className="mt-3 block text-[0.54em] tracking-[-0.035em] text-muted-foreground">
                MiaoMiaoVerse
              </span>
            </h1>
            <p className="mt-8 max-w-xl text-base leading-8 text-muted-foreground sm:text-lg">
              猫咪百科 · AI 文案 · 表情包生成 · 疗愈问答，一站式猫奴乐园
            </p>
            <div className="mt-9 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Link
                href="#missions"
                className={cn(
                  buttonVariants({ size: 'lg' }),
                  'min-h-11 px-5 text-base shadow-panel',
                )}
              >
                进入任务舱
                <ArrowDown aria-hidden="true" />
              </Link>
              <Link
                href="/cat-gallery"
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'lg' }),
                  'min-h-11 px-5 text-base',
                )}
              >
                浏览猫咪档案
                <BookOpen aria-hidden="true" />
              </Link>
            </div>
          </motion.div>
        </motion.div>

        <motion.div
          style={{
            y: shouldReduceMotion ? 0 : catY,
            opacity: shouldReduceMotion ? 1 : catOpacity,
          }}
          className="relative min-w-0"
        >
          <CatObservatory cat={cat} />
        </motion.div>
      </div>
    </section>
  )
}
