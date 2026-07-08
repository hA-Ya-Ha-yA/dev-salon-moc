import { ADMIN_AUTH_PATHS } from "@/constants/adminApi"
import { apiFetch } from "@/lib/api"

export type AdminSessionResult = "ok" | "unauthorized" | "error"

/** `admin_users.role`（バックエンドは `owner` / `staff` を返す） */
export type AdminRole = "owner" | "staff"

/**
 * `GET /api/admin/me` の `role` を正規化する。
 * バックエンドは `owner` / `staff` を返すが、旧データや別表記も吸収する。
 */
export function normalizeAdminRole(raw: unknown): AdminRole {
  const normalized = typeof raw === "string" ? raw.trim().toLowerCase() : ""
  if (
    normalized === "owner" ||
    normalized === "admin" ||
    normalized === "administrator" ||
    normalized === "管理者" ||
    normalized === "オーナー"
  ) {
    return "owner"
  }
  return "staff"
}

/** `admin_users` 相当の `GET /api/admin/me` レスポンス（JSON は snake_case を想定） */
export type AdminMeProfile = {
  /** `admin_users.admin_id`（ログイン中の管理者 ID。シフト編集権限の判定に使用） */
  adminId: string | null
  /** `admin_users.name`（表示名） */
  name: string
  /** `admin_users.avatar_url`（画像 URL。null のときは名前をテキスト表示） */
  avatarUrl: string | null
  /** 所属サロン名（API が返す場合のみ。例: `salon_name` や `salon.name`） */
  salonName: string | null
  /** `admin_users.role`。未取得・不正値時は安全側に倒して "staff" 扱い */
  role: AdminRole
}

function trimOrNull(s: unknown): string | null {
  if (s == null) return null
  const t = String(s).trim()
  return t.length > 0 ? t : null
}

/**
 * `GET /api/admin/me` の JSON を `AdminMeProfile` に正規化。
 * バックエンドのフィールド名が多少違っても拾えるようにする。
 */
export function mapAdminMeJson(raw: unknown): AdminMeProfile {
  if (!raw || typeof raw !== "object") {
    return { adminId: null, name: "", avatarUrl: null, salonName: null, role: "staff" }
  }
  const o = raw as Record<string, unknown>

  const name = trimOrNull(o.name) ?? ""

  let avatarUrl = trimOrNull(o.avatar_url)
  if (!avatarUrl && typeof o.avatarUrl === "string") {
    avatarUrl = trimOrNull(o.avatarUrl)
  }

  let salonName = trimOrNull(o.salon_name)
  if (!salonName && o.salon && typeof o.salon === "object") {
    const s = o.salon as Record<string, unknown>
    salonName = trimOrNull(s.name) ?? trimOrNull(s.salon_name)
  }

  const adminId = trimOrNull(o.admin_id) ?? trimOrNull(o.adminId)

  const role = normalizeAdminRole(o.role)

  return {
    adminId,
    name,
    avatarUrl,
    salonName,
    role,
  }
}

export type FetchAdminMeResult =
  | { kind: "ok"; profile: AdminMeProfile }
  | { kind: "unauthorized" }
  | { kind: "error" }

/**
 * `GET /api/admin/me` — 200 で JSON をパース、`admin_users` の表示情報を返す。
 */
export async function fetchAdminMe(): Promise<FetchAdminMeResult> {
  try {
    const res = await apiFetch(ADMIN_AUTH_PATHS.me, { method: "GET" })
    if (res.status === 401) return { kind: "unauthorized" }
    if (!res.ok) return { kind: "error" }
    let raw: unknown
    try {
      raw = await res.json()
    } catch {
      raw = null
    }
    return { kind: "ok", profile: mapAdminMeJson(raw) }
  } catch {
    return { kind: "error" }
  }
}

/**
 * Struct `auth.get_me` — 200 で認証済み、401 で未認証（本文は使わない）。
 */
export async function fetchAdminSession(): Promise<AdminSessionResult> {
  const r = await fetchAdminMe()
  if (r.kind === "ok") return "ok"
  if (r.kind === "unauthorized") return "unauthorized"
  return "error"
}
