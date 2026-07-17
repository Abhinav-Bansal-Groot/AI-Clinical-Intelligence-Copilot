import { apiRequest, ApiError } from './client'
import type { KnowledgeChatMessage, KnowledgeUploadResponse } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

export function uploadKnowledgePdf(token: string, file: File) {
  const formData = new FormData()
  formData.append('file', file)

  return apiRequest<KnowledgeUploadResponse>('/api/v1/knowledge/upload', {
    method: 'POST',
    token,
    formData,
  })
}

type StreamKnowledgeParams = {
  token: string
  question: string
  history?: KnowledgeChatMessage[]
  onToken: (token: string) => void
  signal?: AbortSignal
}

export async function streamKnowledgeQuery({
  token,
  question,
  history = [],
  onToken,
  signal,
}: StreamKnowledgeParams): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/knowledge/query/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'ngrok-skip-browser-warning': 'true',
    },
    body: JSON.stringify({
      question,
      history,
    }),
    signal,
  })

  if (!response.ok) {
    let detail = 'Failed to query knowledge base'
    try {
      const data = await response.json()
      detail = typeof data.detail === 'string' ? data.detail : detail
    } catch {
      // ignore
    }
    throw new ApiError(detail, response.status)
  }

  if (!response.body) {
    throw new ApiError('No response stream received', 502)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n')
    buffer = parts.pop() || ''

    for (const rawLine of parts) {
      const line = rawLine.trimEnd()

      if (!line.startsWith('data:')) continue

      const payload = line.slice(5).trim()
      if (payload === '[DONE]') {
        return
      }

      try {
        const parsed = JSON.parse(payload) as { token?: string }
        if (parsed.token) {
          onToken(String(parsed.token))
        }
      } catch {
        // ignore malformed chunks
      }
    }
  }
}
