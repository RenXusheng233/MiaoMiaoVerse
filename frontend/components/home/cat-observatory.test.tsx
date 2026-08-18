// Bun provides this test module at runtime, but its type package is not installed.
// @ts-expect-error Bun test types are not installed in this project.
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import type { CatBreed } from '@/lib/types/cat'

const { CatObservatory } = await import('./cat-observatory')

const cat: CatBreed = {
  id: 'munchkin',
  name_zh: '曼基康猫',
  name_en: 'Munchkin',
  origin: '美国',
  size: '小型',
  coat: '短毛',
  quote: '测试语录',
  meme_tags: ['测试标签'],
  suitable_owners: ['测试用户'],
  image_url: 'https://cdn2.thecatapi.com/images/munchkin.jpg',
  scores: {
    demolition: 1,
    clingy: 2,
    shedding: 3,
    cost: 4,
    looks: 5,
  },
}

describe('CatObservatory', () => {
  test('exposes an accessible control for pausing the scan animation', () => {
    const markup = renderToStaticMarkup(<CatObservatory cat={cat} />)

    expect(markup).toContain('aria-label="暂停扫描"')
    expect(markup).toContain('aria-pressed="false"')
    expect(markup).toContain('animation-play-state')
  })
})
