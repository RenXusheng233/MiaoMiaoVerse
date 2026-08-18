// Bun provides this test module at runtime, but its type package is not installed.
// @ts-expect-error Bun test types are not installed in this project.
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { HeroSection } from './hero-section'
import type { CatBreed } from '@/lib/types/cat'

const cat: CatBreed = {
  id: 'ragdoll',
  name_zh: '布偶猫',
  name_en: 'Ragdoll',
  origin: '美国',
  size: '大型',
  coat: '长毛',
  quote: '不应出现在观测窗中的语录',
  meme_tags: ['测试标签'],
  suitable_owners: ['测试用户'],
  image_url: 'https://cdn2.thecatapi.com/images/test.jpg',
  scores: {
    demolition: 1,
    clingy: 2,
    shedding: 3,
    cost: 4,
    looks: 5,
  },
}

describe('HeroSection', () => {
  test('links the primary action to missions and the secondary action to the archive', () => {
    const markup = renderToStaticMarkup(<HeroSection cat={cat} />)

    expect(markup).toContain('href="#missions"')
    expect(markup).toContain('进入任务舱')
    expect(markup).toContain('href="/cat-gallery"')
    expect(markup).toContain('浏览猫咪档案')
  })

  test('shows only the allowed breed facts in the observatory readout', () => {
    const markup = renderToStaticMarkup(<HeroSection cat={cat} />)

    expect(markup).toContain('布偶猫')
    expect(markup).toContain('Ragdoll')
    expect(markup).toContain('美国')
    expect(markup).toContain('大型')
    expect(markup).not.toContain('长毛')
    expect(markup).not.toContain('不应出现在观测窗中的语录')
  })
})
