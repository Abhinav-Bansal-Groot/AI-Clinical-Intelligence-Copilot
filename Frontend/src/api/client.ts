const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

type RequestOptions = {
  method?: string
  body?: unknown
  token?: string | null
  formData?: FormData
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    // When using ngrok free tier, browser requests can receive an interstitial HTML warning page
    // unless this header is present. That page does not include CORS headers and breaks fetch().
    'ngrok-skip-browser-warning': 'true',
  }

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`
  }

  let body: BodyInit | undefined

  if (options.formData) {
    body = options.formData
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(options.body)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers,
    body,
  })

  if (!response.ok) {
    let detail = 'Request failed'
    try {
      const data = await response.json()
      detail = typeof data.detail === 'string' ? data.detail : detail
    } catch {
      // ignore JSON parse errors
    }
    throw new ApiError(detail, response.status)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}
