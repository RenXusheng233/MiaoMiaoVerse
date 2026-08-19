'use client'

import { Sparkles } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { ChatMessage as ChatMessageData } from '@/lib/api'

interface ChatMessageProps {
  message: ChatMessageData
  isStreaming: boolean
}

export function ChatMessage({ message, isStreaming }: ChatMessageProps) {
  const isUser = message.role === 'user'
  return (
    <div
      className={cn(
        'chat-message',
        isUser ? 'chat-message--user' : 'chat-message--assistant',
      )}
    >
      <div className="chat-message__meta">
        {isUser ? (
          'YOU / PILOT'
        ) : (
          <>
            <Sparkles aria-hidden="true" />
            MIAO SIGNAL
          </>
        )}
      </div>
      <div className="chat-message__bubble">
        <p className="whitespace-pre-wrap">
          {message.content}
          {isStreaming ? (
            <span aria-hidden="true" className="chat-message__cursor" />
          ) : null}
        </p>
        {message.disclaimer ? (
          <p className="chat-message__disclaimer">⚠️ {message.disclaimer}</p>
        ) : null}
      </div>
    </div>
  )
}
