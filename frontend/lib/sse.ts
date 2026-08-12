/** Minimal fetch-based SSE parser. EventSource cannot POST, so we read the
 * response body as a stream and split frames on blank lines. Reusable by
 * the chat page (3.5). */

export interface SSEEvent {
  event: string // "chunk" | "done" | "error" | ...
  data: unknown // JSON.parse result, or raw text when parsing fails
}

export function parseSSEFrame(frame: string): SSEEvent | null {
  let event = 'message'
  const dataLines: string[] = []
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim()
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim())
    }
  }
  if (dataLines.length === 0) {
    return null
  }
  const raw = dataLines.join('\n')
  try {
    return { event, data: JSON.parse(raw) }
  } catch {
    return { event, data: raw }
  }
}

export async function streamSSE(
  url: string,
  options: RequestInit,
  onEvent: (evt: SSEEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(url, { ...options, signal })
  if (!res.ok) {
    throw new Error(`SSE request failed: ${res.status}`)
  }
  if (!res.body) {
    throw new Error('SSE response has no body')
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    buffer += decoder.decode(value, { stream: true })
    const frames = buffer.split('\n\n')
    buffer = frames.pop() ?? ''
    for (const frame of frames) {
      const evt = parseSSEFrame(frame)
      if (evt) {
        onEvent(evt)
      }
    }
  }
}
