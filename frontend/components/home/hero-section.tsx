'use client'

import { useRef } from 'react'
import { ArrowDown, BookOpen } from 'lucide-react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'

import { CosmicBackground } from '@/components/shared/cosmic-background'
import { CosmicButton } from '@/components/home/cosmic-button'
import { VersePortal } from '@/components/home/verse-portal'
import type { CatBreed } from '@/lib/types/cat'

import styles from './home.module.css'

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
  const textY = useTransform(scrollYProgress, [0, 1], [0, -24])
  const portalY = useTransform(scrollYProgress, [0, 1], [0, -48])

  return (
    <section
      ref={sectionRef}
      aria-labelledby="home-hero-title"
      className={styles['home-hero']}
    >
      <CosmicBackground />

      <div className={styles['home-hero__layout']}>
        <motion.div
          style={{ y: shouldReduceMotion ? 0 : textY }}
          className={styles['home-hero__copy']}
        >
          <motion.p
            initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className={styles['home-hero__eyebrow']}
          >
            <span aria-hidden="true" />
            喵喵宇宙 · MULTIVERSE GATEWAY
          </motion.p>

          <h1 id="home-hero-title" className={styles['home-hero__title']}>
            <motion.span
              initial={shouldReduceMotion ? false : { opacity: 0, x: -18 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.12, duration: 0.42, ease: 'easeOut' }}
              className={styles['home-hero__miao']}
            >
              MiaoMiao
            </motion.span>
            <motion.span
              initial={
                shouldReduceMotion ? false : { opacity: 0, scaleX: 0.72 }
              }
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ delay: 0.32, duration: 0.7, ease: 'easeOut' }}
              className={styles['home-hero__verse']}
            >
              <span
                aria-hidden="true"
                className={styles['home-hero__verse-glow']}
              >
                Verse
              </span>
              Verse
            </motion.span>
          </h1>

          <motion.p
            initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.38, ease: 'easeOut' }}
            className={styles['home-hero__description']}
          >
            穿过星门，探索猫咪百科、AI 文案、表情包生成与疗愈问答。
          </motion.p>

          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.08, duration: 0.34, ease: 'easeOut' }}
            className={styles['home-hero__actions']}
          >
            <CosmicButton variant="primary" href="#missions">
              进入任务舱
              <ArrowDown aria-hidden="true" />
            </CosmicButton>
            <CosmicButton variant="secondary" href="/cat-gallery">
              浏览猫咪档案
              <BookOpen aria-hidden="true" />
            </CosmicButton>
          </motion.div>
        </motion.div>

        <motion.div
          style={{ y: shouldReduceMotion ? 0 : portalY }}
          className={styles['home-hero__portal']}
        >
          <VersePortal cat={cat} />
        </motion.div>
      </div>
      <div aria-hidden="true" className={styles['home-hero__fade']} />
    </section>
  )
}
