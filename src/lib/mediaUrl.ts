import { apiUrl } from "@/lib/api"

/** サーバー保存パスまたは外部 URL を img 等の src に使える URL に変換する */
export function resolvePublicAssetUrl(pathOrUrl: string): string {
  const s = pathOrUrl.trim()
  if (!s) return ""
  if (/^https?:\/\//i.test(s)) return s
  return apiUrl(s.startsWith("/") ? s : `/${s}`)
}
