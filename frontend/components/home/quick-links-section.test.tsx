// Bun provides this test module at runtime, but its type package is not installed.
// @ts-expect-error Bun test types are not installed in this project.
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { QuickLinksSection } from './quick-links-section'

describe('QuickLinksSection', () => {
  test('keeps all three mission links in the compact desktop grid', () => {
    const markup = renderToStaticMarkup(<QuickLinksSection />)
    const section = markup.match(/<section[^>]*id="missions"[^>]*>/)?.[0]

    expect(section).toContain('max-w-5xl')
    expect(section).toContain('grid-cols-1')
    expect(section).toContain('sm:grid-cols-3')
    expect(markup).not.toContain('lg:col-span-7')
    expect(markup).not.toContain('lg:row-span-2')
  })

  test('uses compact icon and content sizing for each mission link', () => {
    const markup = renderToStaticMarkup(<QuickLinksSection />)

    expect(markup).toContain('size-10')
    expect(markup).toContain('size-5')
    expect(markup).toContain('text-xl')
    expect(markup).not.toContain('size-12')
    expect(markup).not.toContain('text-2xl')
  })
})
