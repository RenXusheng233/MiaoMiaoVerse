import Link from 'next/link'
import { StudioWorkspace } from '@/components/meme-studio/studio-workspace'
import { CosmicBackground } from '@/components/shared/cosmic-background'

import styles from '@/components/meme-studio/meme-studio.module.css'

export default function MemeStudioPage() {
  return (
    <>
      {/* The editor is desktop-only (the three-panel layout needs a wide,
          pointer-driven screen). CSS media queries keep the decision
          hydration-safe for phones, tablets, and touch devices. */}
      <div className={styles['meme-editor-shell']}>
        <StudioWorkspace />
      </div>
      <div className={styles['meme-device-notice']}>
        <CosmicBackground />
        <div className={styles['meme-mobile-card']}>
          <span className={styles['meme-mobile-card__icon']} aria-hidden>
            🐱
          </span>
          <h1 className={styles['meme-mobile-card__title']}>表情包工作室</h1>
          <p className={styles['meme-mobile-card__message']}>
            该功能仅支持 PC 端使用
          </p>
          <p className={styles['meme-mobile-card__description']}>
            请使用电脑浏览器打开本页面，体验完整的拖拽式表情包创作
          </p>
          <Link href="/" className={styles['meme-mobile-card__back']}>
            ← 返回首页
          </Link>
        </div>
      </div>
    </>
  )
}
