'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Copy, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { CopyStyle } from '@/lib/api'
import { cn } from '@/lib/utils'

import styles from './copywriting.module.css'

const STYLE_META: Record<
  CopyStyle,
  { label: string; emoji: string; code: string }
> = {
  funny: { label: '搞笑版', emoji: '😂', code: 'LIGHT FREQUENCY' },
  healing: { label: '治愈版', emoji: '🫂', code: 'WARM FREQUENCY' },
  cool: { label: '高冷版', emoji: '🎭', code: 'DARK FREQUENCY' },
}

const STYLE_CLASS: Record<CopyStyle, string> = {
  funny: styles['copy-card--funny'],
  healing: styles['copy-card--healing'],
  cool: styles['copy-card--cool'],
}

interface CopyCardProps {
  style: CopyStyle
  text: string
  isGenerating: boolean
  isRegenerating: boolean
  onRegenerate: () => void
  hasGenerated: boolean
}

export function CopyCard({
  style,
  text,
  isGenerating,
  isRegenerating,
  onRegenerate,
  hasGenerated,
}: CopyCardProps) {
  const meta = STYLE_META[style]
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>(
    'idle',
  )
  const [isExpanded, setIsExpanded] = useState(false)
  const [isExpandable, setIsExpandable] = useState(false)
  const textRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    setIsExpanded(false)
    setIsExpandable(false)
  }, [text])

  useEffect(() => {
    if (!text || isExpanded) {
      return
    }

    const element = textRef.current
    if (!element) {
      return
    }

    const measureOverflow = () => {
      setIsExpandable(element.scrollHeight > element.clientHeight + 1)
    }

    measureOverflow()
    const observer = new ResizeObserver(measureOverflow)
    observer.observe(element)

    return () => observer.disconnect()
  }, [isExpanded, text])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), 2000)
    } catch {
      setCopyState('failed')
      setTimeout(() => setCopyState('idle'), 2000)
    }
  }

  const busy = isGenerating || isRegenerating
  const statusLabel = busy
    ? 'STREAMING'
    : text
      ? 'READY TO POST'
      : hasGenerated
        ? 'REGENERATE TO RETRY'
        : 'AWAITING INPUT'

  return (
    <Card className={cn(styles['copy-card'], STYLE_CLASS[style])}>
      <CardHeader className={styles['copy-card__header']}>
        <div className={styles['copy-card__identity']}>
          <span className={styles['copy-card__emoji']} aria-hidden="true">
            {meta.emoji}
          </span>
          <div>
            <CardTitle className={styles['copy-card__title']}>
              {meta.label}
            </CardTitle>
            <span className={styles['copy-card__tone']}>{meta.code}</span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className={styles['copy-card__regenerate']}
          onClick={onRegenerate}
          disabled={busy || !hasGenerated}
        >
          <RefreshCw
            className={cn(isRegenerating && 'animate-spin')}
            aria-hidden="true"
          />
          重新生成
        </Button>
      </CardHeader>

      <CardContent className={styles['copy-card__body']}>
        <p
          className={cn(
            styles['copy-card__status'],
            busy && styles['copy-card__status--active'],
          )}
        >
          <span
            className={styles['copy-card__status-dot']}
            aria-hidden="true"
          />
          {statusLabel}
        </p>
        {text ? (
          <div className={styles['copy-card__text-wrap']}>
            <p
              ref={textRef}
              className={cn(
                styles['copy-card__text'],
                isExpanded && styles['copy-card__text--expanded'],
              )}
            >
              {text}
              {busy ? (
                <span
                  className={styles['copy-card__cursor']}
                  aria-label="正在生成"
                />
              ) : null}
            </p>
            {isExpandable ? (
              <button
                type="button"
                className={styles['copy-card__expand']}
                aria-expanded={isExpanded}
                onClick={() => setIsExpanded((expanded) => !expanded)}
              >
                {isExpanded ? '收起全文' : '展开全文'}
                <ChevronDown
                  className={styles['copy-card__expand-icon']}
                  aria-hidden="true"
                />
              </button>
            ) : null}
          </div>
        ) : (
          <div className={styles['copy-card__empty']}>
            <span
              className={styles['copy-card__empty-mark']}
              aria-hidden="true"
            >
              ✦
            </span>
            <span>
              {busy
                ? '正在捕捉新的讯号…'
                : hasGenerated
                  ? '暂时没有内容，请重新生成。'
                  : '生成后将在这里出现。'}
            </span>
          </div>
        )}
      </CardContent>

      <CardFooter className={styles['copy-card__footer']}>
        <Button
          variant="secondary"
          className={styles['copy-card__copy-button']}
          onClick={handleCopy}
          disabled={!text}
        >
          {copyState === 'copied' ? (
            <Check aria-hidden="true" />
          ) : (
            <Copy aria-hidden="true" />
          )}
          {copyState === 'copied'
            ? '已复制 ✓'
            : copyState === 'failed'
              ? '复制失败'
              : '一键复制'}
        </Button>
      </CardFooter>
    </Card>
  )
}
