// Bun provides this test module at runtime, but its type package is not installed.
// @ts-expect-error Bun test types are not installed in this project.
import { describe, expect, test } from 'bun:test'

import { resolveTheme } from './theme'

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
})
