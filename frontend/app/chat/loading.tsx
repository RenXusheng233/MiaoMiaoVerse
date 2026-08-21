import { CosmicBackground } from '@/components/shared/cosmic-background'
import { cn } from '@/lib/utils'

import styles from '@/components/chat/chat.module.css'

export default function Loading() {
  return (
    <main className={styles['chat-shell']}>
      <CosmicBackground />
      <div
        className={cn(styles['chat-console'], styles['chat-console--loading'])}
      >
        <div className={styles['chat-loading__header']}>
          <div className={styles['chat-loading__back']} />
          <div className={styles['chat-loading__eyebrow']} />
          <div className={styles['chat-loading__title']} />
          <div className={styles['chat-loading__description']} />
        </div>
        <div
          className={cn(
            styles['chat-console__surface'],
            styles['chat-loading__surface'],
          )}
        >
          <div className={styles['chat-loading__stream']}>
            <div
              className={cn(
                styles['chat-loading__line'],
                styles['chat-loading__line--short'],
              )}
            />
            <div
              className={cn(
                styles['chat-loading__line'],
                styles['chat-loading__line--long'],
              )}
            />
          </div>
          <div className={styles['chat-loading__composer']} />
        </div>
      </div>
    </main>
  )
}
