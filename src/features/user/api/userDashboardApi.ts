import { fetchSalonPage } from "@/features/user/api/userSalonApi"
import type { UserDashboardSummary } from "@/features/user/types/userDashboard"

const DEFAULT_MESSAGE = "概要情報は未設定です"
const DEFAULT_IMAGE_URL =
  "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1400&q=80"
const WEEKDAY_ORDER = ["月", "火", "水", "木", "金", "土", "日"] as const

function simplifyBusinessHours(summary?: string | null): string {
  const normalized = summary?.trim()
  if (!normalized) return "営業時間情報は未設定です"

  const compact = normalized.replace(/\s+/g, " ")
  const parsed = Array.from(
    compact.matchAll(/([月火水木金土日])\s*:\s*(.+?)(?=\s+[月火水木金土日]\s*:|$)/g),
    (match) => ({
      day: match[1],
      value: match[2].trim(),
    }),
  )

  if (parsed.length !== WEEKDAY_ORDER.length) {
    return normalized.replace(/\s*\r?\n\s*/g, " / ")
  }

  const ordered = WEEKDAY_ORDER.map((day) => parsed.find((item) => item?.day === day) ?? null)
  if (ordered.some((item) => item == null)) {
    return normalized.replace(/\s*\r?\n\s*/g, " / ")
  }

  const groups: Array<{ start: string; end: string; value: string }> = []
  for (const item of ordered) {
    if (!item) continue
    const lastGroup = groups[groups.length - 1]
    if (lastGroup && lastGroup.value === item.value) {
      lastGroup.end = item.day
      continue
    }
    groups.push({ start: item.day, end: item.day, value: item.value })
  }

  return groups
    .map((group) =>
      `${group.start}${group.start === group.end ? "" : `-${group.end}`} ${group.value}`,
    )
    .join(" / ")
}

export async function fetchUserDashboardSummary(shopId?: string): Promise<UserDashboardSummary> {
  const page = await fetchSalonPage(shopId)
  const firstMenu = page.menus[0]
  const shopOverview = page.description?.trim() || DEFAULT_MESSAGE
  return {
    title: "予約ダッシュボード",
    message: shopOverview,
    shopName: page.salon_name,
    shopOverview,
    shopAddress: page.address?.trim() || "住所情報は未設定です",
    businessHours: simplifyBusinessHours(page.business_hours_summary),
    shopImageUrl: firstMenu?.image_url ?? DEFAULT_IMAGE_URL,
  }
}
