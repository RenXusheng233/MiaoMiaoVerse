'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react'

import { CopyCard } from '@/components/copywriting/copy-card'
import { CopyForm } from '@/components/copywriting/copy-form'
import { CosmicBackground } from '@/components/shared/cosmic-background'
import {
  generateCopyStream,
  regenerateCopyStream,
  type CopyForm as CopyFormData,
  type CopyStyle,
} from '@/lib/api'
import type { CatBreed } from '@/lib/types/cat'
import type { SSEEvent } from '@/lib/sse'
import { cn } from '@/lib/utils'

import styles from './copywriting.module.css'

const STYLES: CopyStyle[] = ['funny', 'healing', 'cool']

interface CopyWorkspaceProps {
  cats: CatBreed[]
}

export function CopyWorkspace({ cats }: CopyWorkspaceProps) {
  const [form, setForm] = useState<CopyFormData>({
    cat_name: '',
    platform: 'moments',
  })
  const lastFormRef = useRef<CopyFormData | null>(null)
  const [results, setResults] = useState<Record<CopyStyle, string>>({
    funny: '',
    healing: '',
    cool: '',
  })
  const [status, setStatus] = useState<
    'idle' | 'generating' | 'complete' | 'error'
  >('idle')
  const [regenerating, setRegenerating] = useState<CopyStyle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const errorSeenRef = useRef(false)
  const doneCountRef = useRef(0)

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  function handleSSE(evt: SSEEvent) {
    if (evt.event === 'chunk') {
      const { style, content } = evt.data as {
        style: CopyStyle
        content: string
      }
      setResults((prev) => ({ ...prev, [style]: prev[style] + content }))
    } else if (evt.event === 'done') {
      doneCountRef.current += 1
    } else if (evt.event === 'error') {
      errorSeenRef.current = true
      setError('文案生成失败，请稍后重试')
      setStatus('error')
    }
  }

  async function handleGenerate() {
    if (!form.cat_name.trim()) {
      return
    }
    abortRef.current?.abort() // stop any in-flight regenerate
    errorSeenRef.current = false
    doneCountRef.current = 0
    lastFormRef.current = { ...form }
    setResults({ funny: '', healing: '', cool: '' })
    setError(null)
    setStatus('generating')
    const ac = new AbortController()
    abortRef.current = ac
    try {
      await generateCopyStream(form, handleSSE, ac.signal)
      if (!errorSeenRef.current && doneCountRef.current >= STYLES.length) {
        setStatus('complete')
      } else if (!errorSeenRef.current) {
        // stream ended without the expected done events — treat as truncated
        setError('文案生成中断，请稍后重试')
        setStatus('error')
      }
    } catch {
      if (!ac.signal.aborted) {
        setError('生成失败，请检查后端服务后重试')
        setStatus('error')
      }
    }
  }

  async function handleRegenerate(style: CopyStyle) {
    if (!lastFormRef.current) {
      return
    }
    abortRef.current?.abort() // stop any in-flight generate
    errorSeenRef.current = false
    doneCountRef.current = 0
    setRegenerating(style)
    setResults((prev) => ({ ...prev, [style]: '' }))
    setError(null)
    const ac = new AbortController()
    abortRef.current = ac
    try {
      await regenerateCopyStream(
        { ...lastFormRef.current, style },
        handleSSE,
        ac.signal,
      )
      if (!errorSeenRef.current) {
        setStatus('complete') // a failed generate leaves "error"; success restores it
      }
    } catch {
      if (!ac.signal.aborted) {
        setError('重新生成失败，请稍后重试')
      }
    } finally {
      setRegenerating((cur) => (cur === style ? null : cur))
    }
  }

  const isBusy = status === 'generating' || regenerating !== null
  const statusLabel =
    status === 'generating'
      ? 'STREAMING'
      : status === 'complete'
        ? 'SIGNAL READY'
        : status === 'error'
          ? 'SIGNAL LOST'
          : 'AWAITING INPUT'
  const statusClass =
    status === 'generating'
      ? styles['copy-panel__status--active']
      : status === 'error'
        ? styles['copy-panel__status--error']
        : undefined
  const resultsStatusClass =
    status === 'generating'
      ? styles['copy-results__status--active']
      : status === 'error'
        ? styles['copy-results__status--error']
        : undefined

  return (
    <main className={styles['copy-shell']}>
      <CosmicBackground />

      <div className={styles['copy-console']}>
        <Link href="/" className={styles['copy-console__back']}>
          <ArrowLeft aria-hidden="true" />
          返回首页
        </Link>

        <header className={styles['copy-console__header']}>
          <p className={styles['copy-console__eyebrow']}>
            <span aria-hidden="true" />
            喵喵宇宙 · COPY LAB
          </p>
          <h1 className={styles['copy-console__title']}>
            朋友圈<span>文案神器</span>
          </h1>
          <div className={styles['copy-console__subhead']}>
            <p className={styles['copy-console__description']}>
              把猫咪的日常，调成一条会被点赞的朋友圈讯号。
            </p>

            <div className={styles['copy-signal-rail']} aria-hidden="true">
              <span>猫咪日常</span>
              <i />
              <Sparkles />
              <i />
              <span>朋友圈讯号</span>
              <ArrowRight />
            </div>
          </div>
        </header>

        <div className={styles['copy-console__workspace']}>
          <section
            aria-label="文案生成设置"
            className={styles['copy-composer']}
          >
            <div className={styles['copy-panel__head']}>
              <div>
                <p className={styles['copy-panel__eyebrow']}>INPUT SIGNAL</p>
                <h2 className={styles['copy-panel__title']}>输入猫咪情报</h2>
                <p className={styles['copy-panel__description']}>
                  越接近真实日常，生成的语气越像它。
                </p>
              </div>
              <p className={cn(styles['copy-panel__status'], statusClass)}>
                <span aria-hidden="true" />
                {statusLabel}
              </p>
            </div>

            <CopyForm
              value={form}
              onChange={setForm}
              cats={cats}
              disabled={isBusy}
              onSubmit={handleGenerate}
            />
            {error ? (
              <p role="alert" className={styles['copy-error']}>
                {error}
              </p>
            ) : null}
          </section>

          <section
            aria-label="生成的三种风格文案"
            className={styles['copy-results']}
          >
            <div className={styles['copy-results__head']}>
              <div>
                <p className={styles['copy-results__eyebrow']}>OUTPUT DECK</p>
                <h2 className={styles['copy-results__title']}>
                  三种语气，一次到位
                </h2>
                <p className={styles['copy-results__description']}>
                  选一条，复制后直接发圈。
                </p>
              </div>
              <div>
                <p
                  className={cn(
                    styles['copy-results__status'],
                    resultsStatusClass,
                  )}
                >
                  <span aria-hidden="true" />
                  {statusLabel}
                </p>
                <p className={styles['copy-results__meta']}>
                  <strong>03</strong>
                  <span>STYLE VARIANTS</span>
                </p>
              </div>
            </div>

            <div className={styles['copy-results__grid']}>
              {STYLES.map((style) => (
                <CopyCard
                  key={style}
                  style={style}
                  text={results[style]}
                  isGenerating={status === 'generating'}
                  isRegenerating={regenerating === style}
                  onRegenerate={() => handleRegenerate(style)}
                  hasGenerated={
                    status === 'complete' ||
                    status === 'error' ||
                    results[style].length > 0
                  }
                />
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
