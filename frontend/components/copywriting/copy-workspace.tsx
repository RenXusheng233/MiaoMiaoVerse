'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { CopyCard } from '@/components/copywriting/copy-card'
import { CopyForm } from '@/components/copywriting/copy-form'
import {
  generateCopyStream,
  regenerateCopyStream,
  type CopyForm as CopyFormData,
  type CopyStyle,
} from '@/lib/api'
import type { CatBreed } from '@/lib/types/cat'
import type { SSEEvent } from '@/lib/sse'

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

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <Link
        href="/"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← 返回首页
      </Link>
      <header className="mb-8 text-center">
        <h1 className="font-heading text-3xl text-foreground">
          朋友圈文案神器
        </h1>
        <p className="mt-2 text-muted-foreground">
          填上猫咪的信息，一键生成三个风格的文案
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,360px)_1fr]">
        <div>
          <CopyForm
            value={form}
            onChange={setForm}
            cats={cats}
            disabled={status === 'generating' || regenerating !== null}
            onSubmit={handleGenerate}
          />
          {error ? (
            <p className="mt-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
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
      </div>
    </div>
  )
}
