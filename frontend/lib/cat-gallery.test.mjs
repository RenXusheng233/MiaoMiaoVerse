import { describe, expect, test } from 'bun:test'

import { filterAndSortCats, selectHomeCats } from './cat-gallery'

function makeCat(id, nameZh, nameEn) {
  return {
    id,
    name_zh: nameZh,
    name_en: nameEn,
    origin: '测试地区',
    size: '中型',
    coat: '短毛',
    quote: '测试语录',
    meme_tags: ['测试标签'],
    suitable_owners: ['久坐打工人'],
    image_url: `https://example.com/${id}.jpg`,
    scores: {
      demolition: 5,
      clingy: 5,
      shedding: 5,
      cost: 5,
      looks: 5,
    },
  }
}

describe('selectHomeCats', () => {
  test('keeps the original featured breeds in a stable order', () => {
    const cats = [
      makeCat('abyssinian', '阿比西尼亚猫', 'Abyssinian'),
      makeCat('sphynx', '斯芬克斯猫', 'Sphynx'),
      makeCat('maine_coon', '缅因猫', 'Maine Coon'),
      makeCat('ragdoll', '布偶猫', 'Ragdoll'),
      makeCat('norwegian_forest', '挪威森林猫', 'Norwegian Forest Cat'),
      makeCat('siamese', '暹罗猫', 'Siamese'),
      makeCat('persian', '波斯猫', 'Persian'),
      makeCat('scottish_fold', '苏格兰折耳猫', 'Scottish Fold'),
      makeCat('british_shorthair', '英国短毛猫', 'British Shorthair'),
    ]

    expect(selectHomeCats(cats).map((cat) => cat.id)).toEqual([
      'ragdoll',
      'british_shorthair',
      'scottish_fold',
      'siamese',
      'persian',
      'maine_coon',
      'norwegian_forest',
      'abyssinian',
    ])
  })
})

describe('filterAndSortCats', () => {
  const cats = [
    makeCat('dragon_li', '中国狸花猫', 'Dragon Li'),
    makeCat('devon_rex', '德文卷毛猫', 'Devon Rex'),
    makeCat('birman', '伯曼猫', 'Birman'),
  ]

  test('matches English names without case sensitivity', () => {
    expect(filterAndSortCats(cats, '  DeVoN  ').map((cat) => cat.id)).toEqual([
      'devon_rex',
    ])
  })

  test('matches Chinese name substrings', () => {
    expect(filterAndSortCats(cats, '狸花').map((cat) => cat.id)).toEqual([
      'dragon_li',
    ])
  })

  test('returns all breeds sorted by Chinese name for an empty query', () => {
    expect(filterAndSortCats(cats, '').map((cat) => cat.id)).toEqual([
      'birman',
      'devon_rex',
      'dragon_li',
    ])
  })
})
