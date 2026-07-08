import { ADMIN_PROFILE_PATH } from "@/constants/adminApi"
import { apiFetch } from "@/lib/api"

/**
 * `PUT /api/admin/profile` のリクエストボディ。
 * バックエンド: `app/api/admin/profile.py::update_profile`（`SalonProfileUpdate`）。
 *
 * - `Cookie: access_token` 必須（signup 直後は自動でセットされている）
 * - `exclude_unset=True` で扱われるため、未送信のキーは更新されない
 * - 既存プロフィールが無ければ新規作成、有れば既存を UPDATE
 */
export type AdminProfileUpdateInput = {
  salon_name?: string
  slug?: string
  description?: string | null
  logo_url?: string | null
  cover_image_url?: string | null
  phone?: string | null
  address?: string | null
  instagram_url?: string | null
  line_url?: string | null
  website_url?: string | null
  /** HEX color e.g. `#6366f1` */
  theme_color?: string | null
  booking_page_message?: string | null
  cancellation_policy_text?: string | null
  /** Asia/Tokyo 等 */
  timezone?: string | null
}

export type AdminProfileUpdateResult =
  | { kind: "ok" }
  | { kind: "conflict"; message?: string }
  | { kind: "unauthorized" }
  | { kind: "error"; status?: number; message?: string }

function readableDetail(detail: unknown): string | undefined {
  if (typeof detail === "string") return detail
  if (Array.isArray(detail)) {
    for (const item of detail) {
      if (item && typeof item === "object") {
        const m = (item as { msg?: unknown }).msg
        if (typeof m === "string" && m.trim()) return m
      }
    }
  }
  return undefined
}

export async function putAdminProfile(
  payload: AdminProfileUpdateInput,
): Promise<AdminProfileUpdateResult> {
  try {
    const res = await apiFetch(ADMIN_PROFILE_PATH, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (res.ok) return { kind: "ok" }

    let detailString: string | undefined
    try {
      const data = (await res.clone().json()) as { detail?: unknown } | null
      detailString = readableDetail(data?.detail)
    } catch {
      // non-JSON body
    }

    if (res.status === 401) return { kind: "unauthorized" }
    if (res.status === 409) return { kind: "conflict", message: detailString }
    return { kind: "error", status: res.status, message: detailString }
  } catch {
    return { kind: "error" }
  }
}
