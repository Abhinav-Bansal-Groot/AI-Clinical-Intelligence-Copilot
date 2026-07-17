import { apiRequest, ApiError } from './client'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

export type DashboardCopilotMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type DashboardCopilotBootstrap = {
  doctor_name: string
  suggested_queries: string[]
}

export function getDashboardCopilotBootstrap(token: string) {
  return apiRequest<DashboardCopilotBootstrap>('/api/v1/dashboard-copilot/bootstrap', {
    token,
  })
}

type StreamDashboardCopilotParams = {
  token: string
  message: string
  history: DashboardCopilotMessage[]
  onToken: (token: string) => void
  signal?: AbortSignal
}

export async function streamDashboardCopilot({
  token,
  message,
  history,
  onToken,
  signal,
}: StreamDashboardCopilotParams): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/dashboard-copilot/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'ngrok-skip-browser-warning': 'true',
    },
    body: JSON.stringify({ message, history }),
    signal,
  })

  if (!response.ok) {
    let detail = 'Failed to get AI Copilot response'
    try {
      const data = await response.json()
      detail = typeof data.detail === 'string' ? data.detail : detail
    } catch {
      // Ignore non-JSON error responses.
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
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const rawLine of lines) {
      const line = rawLine.trimEnd()
      if (!line.startsWith('data:')) continue

      const payload = line.slice(5).trim()
      if (payload === '[DONE]') return

      try {
        const parsed = JSON.parse(payload) as { token?: string }
        if (parsed.token) onToken(String(parsed.token))
      } catch {
        // Ignore malformed stream fragments.
      }
    }
  }
}
