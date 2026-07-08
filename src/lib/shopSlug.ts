const STORAGE_KEY = "customer_portal_shop_slug"

/**
 * クエリ `shopId` または localStorage に保存された店舗スラッグを返す。
 */
export function resolveShopSlug(input?: string | null): string | null {
  const trimmed = input?.trim()
  if (trimmed) return trimmed
  try {
    const stored = localStorage.getItem(STORAGE_KEY)?.trim()
    if (stored) return stored
  } catch {
    /* ignore */
  }
  return null
}

export function persistShopSlug(slug: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, slug.trim())
  } catch {
    /* ignore */
  }
}

/**
 * 店舗スコープ API パス: `/api/s/{slug}{path}`
 */
export function buildSalonApiPath(shopSlug: string, path: string): string {
  const base = `/api/s/${encodeURIComponent(shopSlug)}`
  if (!path || path === "/") return base
  return path.startsWith("/") ? `${base}${path}` : `${base}/${path}`
}
