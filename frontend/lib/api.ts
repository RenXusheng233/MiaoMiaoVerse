import type { CatBreed, DailyCatResponse } from '@/lib/types/cat'
import { streamSSE, type SSEEvent } from '@/lib/sse'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL

if (!API_BASE_URL) {
  throw new Error('NEXT_PUBLIC_API_BASE_URL is not set')
}

export async function getDailyCat(): Promise<DailyCatResponse> {
  const res = await fetch(`${API_BASE_URL}/api/daily-cat`, {
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`Failed to fetch daily cat: ${res.status}`)
  }
  return res.json()
}

export async function getRandomCat(
  excludeId?: string,
): Promise<DailyCatResponse> {
  const url = new URL(`${API_BASE_URL}/api/daily-cat/random`)
  if (excludeId) {
    url.searchParams.set('exclude_id', excludeId)
  }
  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`Failed to fetch random cat: ${res.status}`)
  }
  return res.json()
}

export async function getCats(): Promise<CatBreed[]> {
  const res = await fetch(`${API_BASE_URL}/api/cats`, {
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`Failed to fetch cats: ${res.status}`)
  }
  return res.json()
}

export async function getCat(id: string): Promise<CatBreed | null> {
  const res = await fetch(`${API_BASE_URL}/api/cats/${id}`, {
    cache: 'no-store',
  })
  if (res.status === 404) {
    return null
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch cat ${id}: ${res.status}`)
  }
  return res.json()
}

export type Platform = 'moments' | 'weibo' | 'xiaohongshu' | 'douyin'
export type CopyStyle = 'funny' | 'healing' | 'cool'

export interface CopyForm {
  cat_name: string
  breed?: string
  behavior?: string
  style_pref?: string
  platform: Platform
}

export function generateCopyStream(
  form: CopyForm,
  onEvent: (evt: SSEEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  return streamSSE(
    `${API_BASE_URL}/api/copy/generate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    },
    onEvent,
    signal,
  )
}

export function regenerateCopyStream(
  form: CopyForm & { style: CopyStyle },
  onEvent: (evt: SSEEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  return streamSSE(
    `${API_BASE_URL}/api/copy/regenerate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    },
    onEvent,
    signal,
  )
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  disclaimer?: string // medical-route disclaimer text (compliance)
}

export function sendChatMessage(
  message: string,
  onEvent: (evt: SSEEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  return streamSSE(
    `${API_BASE_URL}/api/chat`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    },
    onEvent,
    signal,
  )
}
