/**
 * API のベース URL（末尾スラッシュなし）。
 * 未設定のときは同一オリジン（例: Vite のプロキシ経由で /api → バックエンド）。
 * 別オリジンに API がある場合は `VITE_API_BASE_URL` を設定する。
 */
export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL as string | undefined
  return raw?.replace(/\/$/, "") ?? ""
}

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`
  return `${getApiBaseUrl()}${p}`
}

/**
 * Cookie（HttpOnly の access_token など）を付与したリクエストに使う。
 * 管理者 API など認証が必要な呼び出しはこちらを利用する。
 */
export function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const url = input.startsWith("http") ? input : apiUrl(input)
  return fetch(url, {
    ...init,
    credentials: "include",
  })
}
