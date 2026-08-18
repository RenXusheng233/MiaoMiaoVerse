// Bun provides this test module at runtime, but its type package is not installed.
// @ts-expect-error Bun test types are not installed in this project.
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { CatGallery } from './cat-gallery'
import type { CatBreed } from '@/lib/types/cat'

const cats: CatBreed[] = [
  {
    id: 'ragdoll',
    name_zh: '布偶猫',
    name_en: 'Ragdoll',
    origin: '美国',
    size: '大型',
    coat: '长毛',
    quote: '测试语录',
    meme_tags: ['测试标签'],
    suitable_owners: ['测试用户'],
    image_url: 'https://cdn2.thecatapi.com/images/ragdoll.jpg',
    scores: {
      demolition: 1,
      clingy: 2,
      shedding: 3,
      cost: 4,
      looks: 5,
    },
  },
  {
    id: 'british_shorthair',
    name_zh: '英国短毛猫',
    name_en: 'British Shorthair',
    origin: '英国',
    size: '中型',
    coat: '短毛',
    quote: '测试语录',
    meme_tags: ['测试标签'],
    suitable_owners: ['测试用户'],
    image_url: 'https://cdn2.thecatapi.com/images/british-shorthair.jpg',
    scores: {
      demolition: 2,
      clingy: 3,
      shedding: 4,
      cost: 5,
      looks: 1,
    },
  },
]

describe('CatGallery', () => {
  test('reports the complete archive count and links to the encyclopedia', () => {
    const markup = renderToStaticMarkup(<CatGallery cats={cats} />)

    expect(markup).toContain('猫咪百科档案')
    expect(markup).toContain('共 2 个品种')
    expect(markup).toContain('href="/cat-gallery"')
    expect(markup).toContain('查看完整百科')
  })

  test('renders archive cards with breed names, origins, and detail links', () => {
    const markup = renderToStaticMarkup(<CatGallery cats={cats} />)

    expect(markup).toContain('布偶猫')
    expect(markup).toContain('Ragdoll')
    expect(markup).toContain('美国')
    expect(markup).toContain('href="/cats/ragdoll"')
    expect(markup).toContain('transition-[transform,opacity]')
    expect(markup).toContain('group-hover:translate-y-full')
    expect(markup).toContain('alt=""')
    expect(markup).not.toContain('transition-[top,opacity]')
    expect(markup).not.toContain('alt="布偶猫"')
  })
})
