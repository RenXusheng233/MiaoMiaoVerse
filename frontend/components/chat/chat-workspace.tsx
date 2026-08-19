'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowUpRight, Sparkles } from 'lucide-react'

import { ChatInput } from '@/components/chat/chat-input'
import { ChatMessage } from '@/components/chat/chat-message'
import { CosmicBackground } from '@/components/shared/cosmic-background'
import { sendChatMessage, type ChatMessage as ChatMessageData } from '@/lib/api'
import type { SSEEvent } from '@/lib/sse'

import styles from './chat.module.css'

const SAMPLE_QUESTIONS = [
  { label: '护理', text: '猫砂盆多久清理一次？' },
  { label: '营养', text: '换粮怎么过渡？' },
  { label: '疾病', text: '猫瘟早期有什么症状？' },
]

export function ChatWorkspace() {
  const [messages, setMessages] = useState<ChatMessageData[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const errorSeenRef = useRef(false)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  // auto-scroll to the latest message
  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages])

  function handleSSE(evt: SSEEvent) {
    if (evt.event === 'chunk') {
      const { content } = evt.data as { content: string }
      setMessages((prev) => {
        const next = [...prev]
        const last = next[next.length - 1]
        if (last && last.role === 'assistant') {
          next[next.length - 1] = { ...last, content: last.content + content }
        }
        return next
      })
    } else if (evt.event === 'disclaimer') {
      const { text } = evt.data as { text: string }
      setMessages((prev) => {
        const next = [...prev]
        const last = next[next.length - 1]
        if (last && last.role === 'assistant') {
          next[next.length - 1] = { ...last, disclaimer: text }
        }
        return next
      })
    } else if (evt.event === 'error') {
      errorSeenRef.current = true
      setError('回答失败，请稍后重试')
    }
  }

  function markLastAssistantFailed() {
    setMessages((prev) => {
      const next = [...prev]
      const last = next[next.length - 1]
      if (last && last.role === 'assistant' && !last.content) {
        next[next.length - 1] = { ...last, content: '回答失败了，请稍后再试。' }
      }
      return next
    })
  }

  async function handleSend(message: string) {
    abortRef.current?.abort() // stop any in-flight stream
    errorSeenRef.current = false
    setError(null)
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: message },
      { role: 'assistant', content: '' },
    ])
    setIsStreaming(true)
    const ac = new AbortController()
    abortRef.current = ac
    try {
      await sendChatMessage(message, handleSSE, ac.signal)
      if (errorSeenRef.current) {
        markLastAssistantFailed()
      }
    } catch {
      if (!ac.signal.aborted) {
        setError('连接失败，请检查后端服务后重试')
        markLastAssistantFailed()
      }
    } finally {
      setIsStreaming(false)
    }
  }

  return (
    <main className={styles['chat-shell']}>
      <CosmicBackground />

      <div className={styles['chat-console']}>
        <Link href="/" className={styles['chat-console__back']}>
          <ArrowLeft aria-hidden="true" />
          返回首页
        </Link>

        <header className={styles['chat-console__header']}>
          <p className={styles['chat-console__eyebrow']}>
            <span aria-hidden="true" />
            喵喵宇宙 · CARE SIGNAL
          </p>
          <h1 className={styles['chat-console__title']}>
            疗愈问答<span>助手</span>
          </h1>
          <p className={styles['chat-console__description']}>
            猫咪护理、营养与健康问题，接入喵喵宇宙的疗愈频道
          </p>
        </header>

        <section
          aria-label="疗愈问答对话区"
          className={styles['chat-console__surface']}
        >
          <div className={styles['chat-console__surface-head']}>
            <span>
              <Sparkles aria-hidden="true" />
              MIAO SIGNAL
            </span>
            <span>REALTIME RESPONSE</span>
          </div>

          <div ref={listRef} className={styles['chat-console__stream']}>
            {messages.length === 0 ? (
              <div className={styles['chat-empty']}>
                <div className={styles['chat-empty__beacon']}>
                  <Sparkles aria-hidden="true" />
                </div>
                <p className={styles['chat-empty__eyebrow']}>
                  CATS / WELLNESS / SIGNAL
                </p>
                <h2 className={styles['chat-empty__title']}>
                  把猫咪的烦恼，交给喵喵宇宙。
                </h2>
                <p className={styles['chat-empty__description']}>
                  选择一个频道开始连接，也可以直接输入你想问的事。
                </p>
                <div className={styles['chat-empty__prompts']}>
                  {SAMPLE_QUESTIONS.map((q) => (
                    <button
                      key={q.text}
                      type="button"
                      onClick={() => handleSend(q.text)}
                      disabled={isStreaming}
                      className={styles['chat-prompt']}
                    >
                      <span className={styles['chat-prompt__label']}>
                        {q.label}
                      </span>
                      <span className={styles['chat-prompt__text']}>
                        {q.text}
                      </span>
                      <ArrowUpRight aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <ChatMessage
                  key={i}
                  message={m}
                  isStreaming={
                    isStreaming &&
                    i === messages.length - 1 &&
                    m.role === 'assistant'
                  }
                />
              ))
            )}
          </div>

          {error ? (
            <p className={styles['chat-console__error']}>{error}</p>
          ) : null}

          <ChatInput disabled={isStreaming} onSend={handleSend} />
        </section>
      </div>
    </main>
  )
}
