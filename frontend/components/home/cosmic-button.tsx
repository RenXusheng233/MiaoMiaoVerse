import Link from 'next/link'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

import styles from './home.module.css'

interface CosmicButtonProps {
  variant: 'primary' | 'secondary'
  href: string
  children: ReactNode
  className?: string
}

export function CosmicButton({
  variant,
  href,
  children,
  className,
}: CosmicButtonProps) {
  return (
    <Link
      href={href}
      className={cn(
        styles['cosmic-button'],
        variant === 'primary'
          ? styles['cosmic-button--primary']
          : styles['cosmic-button--secondary'],
        className,
      )}
    >
      <span className={styles['cosmic-button__content']}>{children}</span>
    </Link>
  )
}
