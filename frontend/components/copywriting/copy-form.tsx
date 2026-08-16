'use client'

import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectGroup,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CopyForm, Platform } from '@/lib/api'
import type { CatBreed } from '@/lib/types/cat'

const BEHAVIOR_CHIPS = [
  '正在拆沙发',
  '刚睡醒',
  '粘人精附体',
  '疯狂跑酷',
  '求摸摸',
  '犯错了装无辜',
]

const STYLE_CHIPS = [
  '带点反差萌',
  '语气沙雕一点',
  '治愈温柔一点',
  '高冷傲娇',
  '撒个娇',
]

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'moments', label: '朋友圈' },
  { value: 'weibo', label: '微博' },
  { value: 'xiaohongshu', label: '小红书' },
  { value: 'douyin', label: '抖音' },
]

interface BreedOption {
  value: string
  label: string
}

interface CopyFormProps {
  value: CopyForm
  onChange: (form: CopyForm) => void
  cats: CatBreed[]
  disabled: boolean
  onSubmit: () => void
}

const CHIP_CLASS =
  'rounded-full border border-border px-3 py-1 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-50'

export function CopyForm({
  value,
  onChange,
  cats,
  disabled,
  onSubmit,
}: CopyFormProps) {
  const set = <K extends keyof CopyForm>(key: K, val: CopyForm[K]) =>
    onChange({ ...value, [key]: val })

  // Base UI filters options through the root `items` prop. The
  // `{ value, label }` shape makes the label drive both the input display and
  // the built-in search filter (the default label stringifier reads `label`),
  // so cats are searchable by name_zh or name_en.
  const breedOptions = useMemo<BreedOption[]>(
    () => [
      { value: '', label: '不填(未知品种)' },
      ...cats.map((c) => ({
        value: c.name_zh,
        label: `${c.name_zh} ${c.name_en}`,
      })),
    ],
    [cats],
  )

  // The selected value must be the full option object for Base UI to match.
  const selectedBreed = useMemo(
    () => breedOptions.find((o) => o.value === value.breed) ?? null,
    [breedOptions, value.breed],
  )

  return (
    <div className="space-y-4">
      {/* 猫咪名字(必填) */}
      <div className="grid gap-1.5">
        <Label htmlFor="cat-name">猫咪名字 *</Label>
        <Input
          id="cat-name"
          value={value.cat_name}
          onChange={(e) => set('cat_name', e.target.value)}
          placeholder="例如：布丁"
          maxLength={50}
          disabled={disabled}
        />
      </div>

      {/* 品种(combobox,可搜索,可不选) */}
      <div className="grid gap-1.5">
        <Label>品种</Label>
        <Combobox
          value={selectedBreed}
          // The option object is reconstructed on every render, so compare by
          // `value` instead of the default referential equality.
          isItemEqualToValue={(a, b) => a.value === b.value}
          // Base UI only runs its built-in query filter (and only then derives
          // the `data-empty` state) when the options are supplied through the
          // `items` prop. Without it, the popup always reports empty while all
          // items stay rendered, so the search never filters and the empty
          // message shows unconditionally.
          items={breedOptions}
          onValueChange={(opt) =>
            set('breed', opt && opt.value ? opt.value : undefined)
          }
          disabled={disabled}
        >
          <ComboboxInput
            placeholder="搜索品种…"
            className="w-full"
            disabled={disabled}
          />
          <ComboboxContent>
            <ComboboxList>
              {/* Function children = "closed template" API: renders only the
                  items that pass the query filter. */}
              {(opt) => (
                <ComboboxItem key={opt.value} value={opt}>
                  {opt.label}
                </ComboboxItem>
              )}
            </ComboboxList>
            <ComboboxEmpty>没有找到匹配的品种</ComboboxEmpty>
          </ComboboxContent>
        </Combobox>
      </div>

      {/* 当前状态/行为 + chips */}
      <div className="grid gap-1.5">
        <Label htmlFor="behavior">当前状态/行为</Label>
        <Input
          id="behavior"
          value={value.behavior ?? ''}
          onChange={(e) => set('behavior', e.target.value || undefined)}
          maxLength={100}
          disabled={disabled}
        />
        <div className="flex flex-wrap gap-2">
          {BEHAVIOR_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => set('behavior', chip)}
              className={CHIP_CLASS}
              disabled={disabled}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* 风格偏好 + chips */}
      <div className="grid gap-1.5">
        <Label htmlFor="style-pref">风格偏好</Label>
        <Input
          id="style-pref"
          value={value.style_pref ?? ''}
          onChange={(e) => set('style_pref', e.target.value || undefined)}
          maxLength={200}
          disabled={disabled}
        />
        <div className="flex flex-wrap gap-2">
          {STYLE_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => set('style_pref', chip)}
              className={CHIP_CLASS}
              disabled={disabled}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* 平台目标 */}
      <div className="grid gap-1.5">
        <Label>平台目标</Label>
        <Select
          items={PLATFORMS}
          value={value.platform}
          onValueChange={(v) => set('platform', v as Platform)}
          disabled={disabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {PLATFORMS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <Button
        onClick={onSubmit}
        disabled={disabled || !value.cat_name.trim()}
        size="lg"
        className="w-full"
      >
        生成文案
      </Button>
      {/* The hint is always rendered — visibility toggles instead of unmount
          so the form height (and the right-side card frames that stretch to
          match it) never jump when a name is typed. */}
      <p
        className={cn(
          'text-sm font-semibold text-destructive',
          value.cat_name.trim() && 'invisible',
        )}
      >
        给猫咪起个名字吧
      </p>
    </div>
  )
}
