import { fetchAdminMe } from "@/features/auth/api/adminSessionApi"
import { ApiClientError, apiRequest } from "@/lib/apiClient"

export interface AdminSalonProfile {
  salon_id: string
  salon_name: string
  slug: string
  description: string | null
  logo_url: string | null
  cover_image_url: string | null
  phone: string | null
  address: string | null
  instagram_url: string | null
  line_url: string | null
  website_url: string | null
  theme_color: string
  booking_page_message: string | null
  cancellation_policy_text: string | null
  timezone: string
}

export interface AdminSalonProfileUpdate {
  salon_name?: string
  slug?: string
  description?: string | null
  phone?: string | null
  address?: string | null
  booking_page_message?: string | null
  cancellation_policy_text?: string | null
  instagram_url?: string | null
  line_url?: string | null
  website_url?: string | null
  timezone?: string
}

function trimOrEmpty(value: unknown): string {
  if (value == null) return ""
  const trimmed = String(value).trim()
  return trimmed
}

function trimOrNull(value: unknown): string | null {
  const trimmed = trimOrEmpty(value)
  return trimmed.length > 0 ? trimmed : null
}

function pickSalonNameFromProfileRaw(raw: Record<string, unknown>, fallback = ""): string {
  const direct = trimOrEmpty(raw.salon_name) || trimOrEmpty(raw.salonName)
  if (direct) return direct

  const salon = raw.salon
  if (salon && typeof salon === "object") {
    const nested = salon as Record<string, unknown>
    const fromSalon = trimOrEmpty(nested.name) || trimOrEmpty(nested.salon_name)
    if (fromSalon) return fromSalon
  }

  return fallback
}

function mapAdminSalonProfile(raw: unknown, salonName = ""): AdminSalonProfile | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>

  return {
    salon_id: String(o.salon_id ?? ""),
    salon_name: salonName,
    slug: String(o.slug ?? ""),
    description: trimOrNull(o.description),
    logo_url: trimOrNull(o.logo_url),
    cover_image_url: trimOrNull(o.cover_image_url),
    phone: trimOrNull(o.phone),
    address: trimOrNull(o.address),
    instagram_url: trimOrNull(o.instagram_url),
    line_url: trimOrNull(o.line_url),
    website_url: trimOrNull(o.website_url),
    theme_color: trimOrEmpty(o.theme_color) || "#6366f1",
    booking_page_message: trimOrNull(o.booking_page_message),
    cancellation_policy_text: trimOrNull(o.cancellation_policy_text),
    timezone: trimOrEmpty(o.timezone) || "Asia/Tokyo",
  }
}

async function resolveSalonNameFallback(): Promise<string> {
  const me = await fetchAdminMe()
  if (me.kind !== "ok") return ""
  return me.profile.salonName?.trim() ?? ""
}

async function fetchSalonNameBySlug(slug: string): Promise<string> {
  const trimmedSlug = slug.trim()
  if (!trimmedSlug) return ""
  try {
    const page = await apiRequest<{ salon_name?: unknown }>(
      `/api/s/${encodeURIComponent(trimmedSlug)}`,
    )
    return trimOrEmpty(page.salon_name)
  } catch {
    return ""
  }
}

async function resolveAdminSalonName(
  raw: Record<string, unknown>,
  slug: string,
): Promise<string> {
  const fromProfile = pickSalonNameFromProfileRaw(raw, await resolveSalonNameFallback())
  if (fromProfile) return fromProfile
  return fetchSalonNameBySlug(slug)
}

export async function fetchAdminSalonProfile(): Promise<AdminSalonProfile | null> {
  try {
    const raw = await apiRequest<unknown>("/api/admin/profile")
    if (!raw || typeof raw !== "object") return null
    const o = raw as Record<string, unknown>
    const slug = trimOrEmpty(o.slug)
    const salon_name = await resolveAdminSalonName(o, slug)
    return mapAdminSalonProfile(raw, salon_name)
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) return null
    throw error
  }
}

export async function updateAdminSalonProfile(
  body: AdminSalonProfileUpdate,
): Promise<AdminSalonProfile> {
  const raw = await apiRequest<unknown>("/api/admin/profile", {
    method: "PUT",
    body,
  })
  if (!raw || typeof raw !== "object") {
    throw new ApiClientError("サロン情報の保存結果を読み取れませんでした。", 500)
  }
  const o = raw as Record<string, unknown>
  const slug = trimOrEmpty(o.slug)
  const salon_name = await resolveAdminSalonName(o, slug)
  const mapped = mapAdminSalonProfile(raw, salon_name)
  if (!mapped) {
    throw new ApiClientError("サロン情報の保存結果を読み取れませんでした。", 500)
  }
  return mapped
}
