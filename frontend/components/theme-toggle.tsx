'use client'

import { Moon, Sun } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { Button } from '@/components/ui/button'
import {
  persistTheme,
  readStoredTheme,
  resolveTheme,
  type ResolvedTheme,
} from '@/lib/theme'

function applyTheme(theme: ResolvedTheme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.style.colorScheme = theme
}

function getBrowserStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function ThemeToggle() {
  const hasManualTheme = useRef(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const storedTheme = readStoredTheme(getBrowserStorage())

    if (storedTheme === 'light' || storedTheme === 'dark') {
      hasManualTheme.current = true
      return
    }

    const handleChange = (event: MediaQueryListEvent) => {
      if (hasManualTheme.current) {
        return
      }

      applyTheme(resolveTheme(null, event.matches))
    }

    mediaQuery.addEventListener('change', handleChange)

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  function toggleTheme() {
    const nextTheme = document.documentElement.classList.contains('dark')
      ? 'light'
      : 'dark'

    persistTheme(getBrowserStorage(), nextTheme)
    hasManualTheme.current = true
    applyTheme(nextTheme)
  }

  return (
    <Button
      aria-label="切换亮暗主题"
      className="theme-star fixed top-4 right-4 z-50 rounded-full shadow-md"
      onClick={toggleTheme}
      size="icon-lg"
      type="button"
      variant="outline"
    >
      <Sun className="hidden dark:block" />
      <Moon className="block dark:hidden" />
    </Button>
  )
}
