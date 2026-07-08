import { API_BASE } from "@/lib/apiBase"

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  body?: unknown
  signal?: AbortSignal
  /** Bearer トークン（予約照会 OTP 認証後など） */
  bearerToken?: string
}

interface ErrorResponse {
  detail?: string | Array<{ msg?: string; message?: string }>
  message?: string
  error?: string
}

export class ApiClientError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiClientError"
    this.status = status
  }
}

function messageFromErrorPayload(data: ErrorResponse): string | null {
  if (typeof data.detail === "string" && data.detail.trim()) return data.detail
  if (Array.isArray(data.detail) && data.detail.length > 0) {
    const first = data.detail[0]
    const m = first?.msg ?? first?.message
    if (typeof m === "string" && m.trim()) return m
  }
  if (typeof data.message === "string" && data.message.trim()) return data.message
  if (typeof data.error === "string" && data.error.trim()) return data.error
  return null
}

function fallbackMessageForStatus(status: number): string {
  if (status === 401) return "再ログインが必要です。"
  if (status === 403) return "この操作は許可されていません。"
  if (status === 404) return "要求された情報が見つかりません。"
  if (status === 409) return "予約枠が競合しました。別の時間を選択してください。"
  if (status === 422) return "入力内容に不備があります。"
  if (status === 400) {
    return "リクエストを処理できませんでした。Stripe の設定やログイン状態を確認するか、開発者ツールの Network でレスポンス本文を確認してください。"
  }
  if (status === 502 || status === 503 || status === 504) {
    return "API サーバーに接続できませんでした。バックエンドが起動しているか確認してください。"
  }
  if (status >= 500) return "サーバーでエラーが発生しました。しばらくしてから再度お試しください。"
  return `通信に失敗しました（HTTP ${status}）。しばらくしてから再度お試しください。`
}

async function parseErrorMessage(response: Response): Promise<string> {
  let raw = ""
  try {
    raw = await response.text()
  } catch {
    return fallbackMessageForStatus(response.status)
  }

  const trimmed = raw.trim()
  if (trimmed) {
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const data = JSON.parse(trimmed) as ErrorResponse
        const fromPayload = messageFromErrorPayload(data)
        if (fromPayload) return fromPayload
      } catch {
        // 本文が JSON 風だがパースできない
      }
    }
    const lower = trimmed.slice(0, 64).toLowerCase()
    if (!lower.startsWith("<!doctype") && !lower.startsWith("<html")) {
      if (trimmed.length <= 500) return trimmed
    }
  }

  return fallbackMessageForStatus(response.status)
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? "GET"
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.bearerToken ? { Authorization: `Bearer ${options.bearerToken}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  })

  if (!response.ok) {
    const message = await parseErrorMessage(response)
    throw new ApiClientError(message, response.status)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}
