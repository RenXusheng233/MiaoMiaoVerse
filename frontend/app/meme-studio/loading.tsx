import { CosmicBackground } from '@/components/shared/cosmic-background'
import { cn } from '@/lib/utils'

import styles from '@/components/meme-studio/meme-studio.module.css'

export default function Loading() {
  return (
    <div className={cn(styles['studio-loading'], 'animate-pulse')}>
      <CosmicBackground />
      <div className={styles['studio-loading__header']} />
      <div className={styles['studio-loading__body']}>
        <div className={styles['studio-loading__palette']} />
        <div className={styles['studio-loading__stage']} />
        <div className={styles['studio-loading__inspector']} />
      </div>
    </div>
  )
}
