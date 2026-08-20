'use client'

import { useMemo } from 'react'
import { Sparkles } from 'lucide-react'

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
import {
  Select,
  SelectGroup,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { CopyForm, Platform } from '@/lib/api'
import type { CatBreed } from '@/lib/types/cat'

import styles from './copywriting.module.css'

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
  const hasCatName = value.cat_name.trim().length > 0

  return (
    <div className={styles['copy-form']}>
      <div className={styles['copy-form__section']}>
        <p className={styles['copy-form__section-label']}>01 / CAT PROFILE</p>

        <div className={styles['copy-field']}>
          <div className={styles['copy-field__label-row']}>
            <Label className={styles['copy-field__label']} htmlFor="cat-name">
              猫咪名字
            </Label>
            <span className={styles['copy-field__required']}>REQUIRED</span>
          </div>
          <Input
            className={styles['copy-control']}
            id="cat-name"
            value={value.cat_name}
            onChange={(e) => set('cat_name', e.target.value)}
            placeholder="例如：布丁"
            maxLength={50}
            disabled={disabled}
          />
          <p
            className={cn(
              styles['copy-field__microcopy'],
              !hasCatName && styles['copy-field__microcopy--required'],
            )}
          >
            {hasCatName ? '告诉我它叫什么，文案开始有性格' : '给猫咪起个名字吧'}
          </p>
        </div>

        <div className={styles['copy-field']}>
          <div className={styles['copy-field__label-row']}>
            <Label className={styles['copy-field__label']}>品种</Label>
            <span className={styles['copy-field__optional']}>OPTIONAL</span>
          </div>
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
              className={cn(styles['copy-control'], 'w-full')}
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
      </div>

      <div className={styles['copy-form__section']}>
        <p className={styles['copy-form__section-label']}>02 / DAILY SIGNAL</p>

        <div className={styles['copy-field']}>
          <div className={styles['copy-field__label-row']}>
            <Label className={styles['copy-field__label']} htmlFor="behavior">
              当前状态 / 行为
            </Label>
            <span className={styles['copy-field__optional']}>OPTIONAL</span>
          </div>
          <Input
            className={styles['copy-control']}
            id="behavior"
            value={value.behavior ?? ''}
            onChange={(e) => set('behavior', e.target.value || undefined)}
            placeholder="例如：刚睡醒，正在踩奶"
            maxLength={100}
            disabled={disabled}
          />
          <div className={styles['copy-chip-list']}>
            {BEHAVIOR_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => set('behavior', chip)}
                className={styles['copy-chip']}
                disabled={disabled}
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles['copy-form__section']}>
        <p className={styles['copy-form__section-label']}>
          03 / VOICE &amp; CHANNEL
        </p>

        <div className={styles['copy-field']}>
          <div className={styles['copy-field__label-row']}>
            <Label className={styles['copy-field__label']} htmlFor="style-pref">
              风格偏好
            </Label>
            <span className={styles['copy-field__optional']}>OPTIONAL</span>
          </div>
          <Input
            className={styles['copy-control']}
            id="style-pref"
            value={value.style_pref ?? ''}
            onChange={(e) => set('style_pref', e.target.value || undefined)}
            placeholder="例如：带点反差萌"
            maxLength={200}
            disabled={disabled}
          />
          <div className={styles['copy-chip-list']}>
            {STYLE_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => set('style_pref', chip)}
                className={styles['copy-chip']}
                disabled={disabled}
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        <div className={styles['copy-field']}>
          <div className={styles['copy-field__label-row']}>
            <Label className={styles['copy-field__label']}>发布平台</Label>
            <span className={styles['copy-field__optional']}>CHANNEL</span>
          </div>
          <Select
            items={PLATFORMS}
            value={value.platform}
            onValueChange={(v) => set('platform', v as Platform)}
            disabled={disabled}
          >
            <SelectTrigger className={cn(styles['copy-control'], 'w-full')}>
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
      </div>

      <Button
        onClick={onSubmit}
        disabled={disabled || !hasCatName}
        size="lg"
        className={styles['copy-form__submit']}
      >
        <Sparkles aria-hidden="true" />
        生成文案
      </Button>
    </div>
  )
}
