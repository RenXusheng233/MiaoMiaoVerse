import type { CatBreed } from '@/lib/types/cat'

const HOME_CAT_IDS = [
  'ragdoll',
  'british_shorthair',
  'scottish_fold',
  'siamese',
  'persian',
  'maine_coon',
  'norwegian_forest',
  'abyssinian',
] as const

export function selectHomeCats(cats: CatBreed[]): CatBreed[] {
  const catsById = new Map(cats.map((cat) => [cat.id, cat]))
  return HOME_CAT_IDS.flatMap((id) => {
    const cat = catsById.get(id)
    return cat ? [cat] : []
  })
}

export function filterAndSortCats(cats: CatBreed[], query: string): CatBreed[] {
  const normalizedQuery = query.trim().toLowerCase()
  const matchingCats = normalizedQuery
    ? cats.filter(
        (cat) =>
          cat.name_zh.toLowerCase().includes(normalizedQuery) ||
          cat.name_en.toLowerCase().includes(normalizedQuery),
      )
    : cats

  return [...matchingCats].sort((left, right) =>
    left.name_zh.localeCompare(right.name_zh, 'zh-CN'),
  )
}
