// Bun provides this test module at runtime, but its type package is not installed.
// @ts-expect-error Bun test types are not installed in this project.
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import type { DailyCatResponse } from '@/lib/types/cat'

process.env.NEXT_PUBLIC_API_BASE_URL ??= 'http://test.invalid'

const { DailyCatWidget } = await import('./daily-cat-widget')

const dailyCat: DailyCatResponse = {
  date: '2026-08-18',
  is_daily: true,
  breed: {
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
}

describe('DailyCatWidget', () => {
  test('renders the featured breed dossier and accessible controls', () => {
    const markup = renderToStaticMarkup(
      <DailyCatWidget initialData={dailyCat} />,
    )

    expect(markup).toContain('Daily transmission / 03')
    expect(markup).toContain('dateTime="2026-08-18"')
    expect(markup).toContain('2026-08-18')
    expect(markup).toContain('布偶猫')
    expect(markup).toContain('Ragdoll')
    expect(markup).toContain('测试语录')
    expect(markup).toContain('换一只')
    expect(markup).toContain('href="/cats/ragdoll"')
    expect(markup).toContain('查看详情')
  })
})
