import Link from 'next/link'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

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
        'cosmic-button',
        variant === 'primary'
          ? 'cosmic-button--primary'
          : 'cosmic-button--secondary',
        className,
      )}
    >
      <span className="cosmic-button__content">{children}</span>
    </Link>
  )
}
