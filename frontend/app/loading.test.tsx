// Bun provides this test module at runtime, but its type package is not installed.
// @ts-expect-error Bun test types are not installed in this project.
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import Loading from './loading'

describe('Loading', () => {
  test('matches the compact three-column mission grid', () => {
    const markup = renderToStaticMarkup(<Loading />)

    expect(markup).toContain(
      'max-w-5xl grid-cols-1 gap-4 px-6 py-12 sm:grid-cols-3',
    )
    expect(markup).toContain('h-36')
    expect(markup).not.toContain('lg:col-span-7')
    expect(markup).not.toContain('lg:row-span-2')
    expect(markup).not.toContain('min-h-56')
  })
})
