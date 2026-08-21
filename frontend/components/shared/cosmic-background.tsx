import { cn } from '@/lib/utils'

import styles from './cosmic-background.module.css'

const STARS = [
  ['9%', '17%', '0s'],
  ['18%', '71%', '-4s'],
  ['31%', '29%', '-7s'],
  ['43%', '84%', '-2s'],
  ['58%', '14%', '-9s'],
  ['69%', '67%', '-5s'],
  ['79%', '23%', '-11s'],
  ['88%', '76%', '-3s'],
  ['95%', '39%', '-8s'],
] as const

export function CosmicBackground() {
  return (
    <div aria-hidden="true" className={styles['cosmic-background']}>
      <div
        className={cn(
          styles['cosmic-background__nebula'],
          styles['cosmic-background__nebula--violet'],
        )}
      />
      <div
        className={cn(
          styles['cosmic-background__nebula'],
          styles['cosmic-background__nebula--cyan'],
        )}
      />
      <div className={styles['cosmic-background__grid']} />
      <div className={styles['cosmic-background__stars']}>
        {STARS.map(([left, top, delay]) => (
          <i
            key={`${left}-${top}`}
            style={{ left, top, animationDelay: delay }}
          />
        ))}
      </div>
      <div className={styles['cosmic-background__route']} />
    </div>
  )
}
