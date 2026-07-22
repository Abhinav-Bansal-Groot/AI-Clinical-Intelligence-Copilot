import { ApiError, notifyUnauthorized } from './client'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

type StreamCopilotParams = {
  token: string
  patientId: number
  message: string
  onToken: (token: string) => void
  signal?: AbortSignal
}

export async function streamCopilotChat({
  token,
  patientId,
  message,
  onToken,
  signal,
}: StreamCopilotParams): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/copilot/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'ngrok-skip-browser-warning': 'true',
    },
    body: JSON.stringify({
      patient_id: patientId,
      message,
    }),
    signal,
  })

  if (!response.ok) {
    if (response.status === 401) {
      notifyUnauthorized()
    }
    let detail = 'Failed to get AI response'
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

    for (const line of parts) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue

      const payload = trimmed.slice(5).trim()
      if (payload === '[DONE]') return

      try {
        const parsed = JSON.parse(payload) as { token?: string }
        if (parsed.token) onToken(parsed.token)
      } catch {
        // ignore malformed chunks
      }
    }
  }
}
