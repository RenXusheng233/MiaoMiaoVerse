// Bun provides this test module at runtime, but its type package is not installed.
// @ts-expect-error Bun test types are not installed in this project.
import { describe, expect, test } from 'bun:test'

import {
  persistTheme,
  readStoredTheme,
  resolveTheme,
  themeBootstrapScript,
} from './theme'

describe('resolveTheme', () => {
  test('prefers a valid persisted theme over the system preference', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  test('falls back to the system preference for invalid or empty persisted values', () => {
    expect(resolveTheme(null, true)).toBe('dark')
    expect(resolveTheme('', false)).toBe('light')
    expect(resolveTheme('sepia', true)).toBe('dark')
  })

  test('survives storage read and write exceptions', () => {
    const throwingStorage = {
      getItem: () => {
        throw new Error('storage unavailable')
      },
      setItem: () => {
        throw new Error('storage unavailable')
      },
    }

    expect(readStoredTheme(throwingStorage)).toBeNull()
    expect(() => persistTheme(throwingStorage, 'dark')).not.toThrow()
  })

  test('guards local storage access during the first paint bootstrap', () => {
    expect(themeBootstrapScript).toContain('window.localStorage.getItem')
    expect(themeBootstrapScript).toContain('try')
  })
})
