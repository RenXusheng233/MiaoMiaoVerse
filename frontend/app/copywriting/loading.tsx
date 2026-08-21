import { CosmicBackground } from '@/components/shared/cosmic-background'
import { cn } from '@/lib/utils'

import styles from '@/components/copywriting/copywriting.module.css'

export default function Loading() {
  return (
    <main className={styles['copy-shell']}>
      <CosmicBackground />

      <div
        className={cn(styles['copy-console'], styles['copy-console--loading'])}
      >
        <div className={styles['copy-loading__back']} />

        <div className={styles['copy-loading__header']}>
          <div className={styles['copy-loading__eyebrow']} />
          <div className={styles['copy-loading__title']} />
          <div className={styles['copy-loading__description']} />
        </div>

        <div className={styles['copy-loading__rail']} />

        <div className={styles['copy-loading__workspace']}>
          <div className={styles['copy-loading__composer']} />
          <div className={styles['copy-loading__results']}>
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className={styles['copy-loading__card']} />
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
