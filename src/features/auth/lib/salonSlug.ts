/** バックエンド `SLUG_PATTERN` と同じ: 先頭末尾は英数字、3文字以上 */
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/

function randomSalonSlugSuffix(): string {
  const c = typeof crypto !== "undefined" ? crypto : undefined
  if (c?.randomUUID) return c.randomUUID().replace(/-/g, "").slice(0, 8)
  return Math.random().toString(16).slice(2, 10)
}

/**
 * サロン名から公開 URL 用 slug のベースを生成（英数字のみ抽出）。
 * 日本語のみなどで規則に合わない場合は null。
 */
export function baseSlugFromSalonName(salonName: string): string | null {
  const raw = salonName.toLowerCase().trim()
  const s = raw.replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
  if (s.length < 3) return null
  return SLUG_PATTERN.test(s) ? s : null
}

/**
 * 管理者サインアップ用の `salon_profiles.slug` をクライアント側で採番する。
 * バックエンドの `_resolve_new_salon_slug`（省略時）と同じ方針。
 */
export function generateSalonSlugForSignup(salonName: string, attempt = 0): string {
  const base = baseSlugFromSalonName(salonName) ?? `salon-${randomSalonSlugSuffix()}`
  if (attempt <= 0) return base
  const candidate = `${base}-${attempt}`
  return SLUG_PATTERN.test(candidate) ? candidate : `salon-${randomSalonSlugSuffix()}`
}

export function isValidSalonSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug.trim().toLowerCase())
}
