'use client'

import { useState } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

import styles from './chat.module.css'

interface ChatInputProps {
  disabled: boolean
  onSend: (message: string) => void
}

export function ChatInput({ disabled, onSend }: ChatInputProps) {
  const [value, setValue] = useState('')

  function handleSend() {
    const trimmed = value.trim()
    if (!trimmed || disabled) {
      return
    }
    onSend(trimmed)
    setValue('')
  }

  return (
    <div className={styles['chat-composer']}>
      <div className={styles['chat-composer__head']}>
        <span>
          <span aria-hidden="true" />
          SIGNAL INPUT
        </span>
        <span>ENTER 发送 · SHIFT+ENTER 换行</span>
      </div>
      <div className={styles['chat-composer__row']}>
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            // skip IME composition confirms (Chinese input method Enter)
            if (
              e.key === 'Enter' &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder="输入猫咪的烦恼，开启疗愈连接…"
          // py-2.5 keeps the single-line placeholder vertically centered
          // (44px height = 10px + 24px line + 10px)
          className={cn(
            styles['chat-composer__textarea'],
            'min-h-11 max-h-32 resize-none py-2.5',
          )}
          disabled={disabled}
        />
        <Button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          size="icon"
          className={cn(styles['chat-composer__send'], 'h-11 w-11 shrink-0')}
          aria-label="发送"
        >
          <Send aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
