import { ADMIN_USERS_LIST_PATH } from "@/constants/adminApi"
import { apiFetch } from "@/lib/api"

/**
 * `POST /api/admin/admin-users` のリクエスト本文。
 * バックエンドの `AdminUserCreate`（`role: "owner" | "staff"`）に対応。
 */
export interface AdminUserCreateInput {
  email: string
  password: string
  name: string
  role: "owner" | "staff"
  avatarUrl?: string | null
  isActive?: boolean
}

/** `POST /api/admin/admin-users` のレスポンス（必要部分のみ） */
export interface AdminUserCreatedOut {
  adminId: string
  email: string
  name: string
  role: string
  isActive: boolean
}

/** API 失敗時のエラータイプ。フォームでの表示分岐に使う */
export type CreateAdminUserError =
  | { kind: "unauthorized" }
  | { kind: "duplicate"; message: string }
  | { kind: "validation"; message: string }
  | { kind: "owner_required"; message: string }
  | { kind: "network"; message: string }

function pickDetailMessage(raw: unknown): string {
  if (!raw || typeof raw !== "object") return ""
  const o = raw as Record<string, unknown>
  if (typeof o.detail === "string") return o.detail
  if (Array.isArray(o.detail)) {
    const first = o.detail.find(
      (x) => x && typeof x === "object" && typeof (x as Record<string, unknown>).msg === "string",
    ) as Record<string, unknown> | undefined
    if (first) return String(first.msg)
  }
  if (typeof o.message === "string") return o.message
  return ""
}

function mapAdminUserCreated(raw: unknown): AdminUserCreatedOut | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const adminId =
    typeof o.admin_id === "string" && o.admin_id.trim()
      ? o.admin_id.trim()
      : typeof o.adminId === "string"
        ? String(o.adminId).trim()
        : ""
  if (!adminId) return null
  return {
    adminId,
    email: typeof o.email === "string" ? o.email : "",
    name: typeof o.name === "string" ? o.name : "",
    role: typeof o.role === "string" ? o.role : "staff",
    isActive: o.is_active === false ? false : true,
  }
}

/**
 * `POST /api/admin/admin-users` —
 * `admin_users` テーブルに新規アカウントを作成する。
 * `role: "staff"` で登録すると、管理者ログイン画面からそのメール/パスワードで
 * ログインできる（権限はスタッフ）。
 */
export async function postAdminUser(
  input: AdminUserCreateInput,
): Promise<{ ok: true; created: AdminUserCreatedOut } | { ok: false; error: CreateAdminUserError }> {
  const body: Record<string, unknown> = {
    email: input.email.trim(),
    password: input.password,
    name: input.name.trim(),
    role: input.role,
    is_active: input.isActive ?? true,
  }
  const av = input.avatarUrl?.trim()
  if (av) body.avatar_url = av

  let res: Response
  try {
    res = await apiFetch(ADMIN_USERS_LIST_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  } catch {
    return { ok: false, error: { kind: "network", message: "通信に失敗しました" } }
  }

  if (res.status === 401) return { ok: false, error: { kind: "unauthorized" } }

  let parsed: unknown = null
  try {
    parsed = await res.json()
  } catch {
    parsed = null
  }
  const detail = pickDetailMessage(parsed)

  if (res.status === 409) {
    return {
      ok: false,
      error: {
        kind: "duplicate",
        message: detail || "このメールアドレスは既に登録されています",
      },
    }
  }
  if (res.status === 400) {
    if (/オーナー/.test(detail)) {
      return {
        ok: false,
        error: { kind: "owner_required", message: detail },
      }
    }
    return {
      ok: false,
      error: { kind: "validation", message: detail || "入力内容に誤りがあります" },
    }
  }
  if (res.status === 422) {
    return {
      ok: false,
      error: { kind: "validation", message: detail || "入力内容に誤りがあります" },
    }
  }
  if (!res.ok) {
    return {
      ok: false,
      error: {
        kind: "network",
        message: detail || "登録に失敗しました。時間をおいて再度お試しください。",
      },
    }
  }

  const created = mapAdminUserCreated(parsed)
  if (!created) {
    return {
      ok: false,
      error: { kind: "network", message: "サーバーからの応答が不正でした" },
    }
  }
  return { ok: true, created }
}

/** `GET /api/admin/admin-users` の1行（オーナーのみ） */
export interface AdminUserListItem {
  adminId: string
  name: string
  email: string
  role: string
  isActive: boolean
}

function mapAdminUserListRow(raw: unknown): AdminUserListItem | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const adminIdRaw = o.admin_id ?? o.adminId
  const adminId = adminIdRaw != null ? String(adminIdRaw).trim() : ""
  if (!adminId) return null
  const name = typeof o.name === "string" ? o.name.trim() : ""
  const email = typeof o.email === "string" ? o.email.trim() : ""
  const role = typeof o.role === "string" ? o.role.trim().toLowerCase() : "staff"
  const isActive = o.is_active === false || o.isActive === false ? false : true
  if (!name) return null
  return { adminId, name, email, role, isActive }
}

/**
 * `GET /api/admin/admin-users` — 同一サロンの管理者/スタッフ一覧（参照はオーナー・スタッフ可）。
 */
export async function fetchAdminUsersList(): Promise<AdminUserListItem[]> {
  const res = await apiFetch(ADMIN_USERS_LIST_PATH, { method: "GET" })
  if (res.status === 401) throw new Error("UNAUTHORIZED")
  if (!res.ok) throw new Error("FETCH_FAILED")
  let data: unknown
  try {
    data = await res.json()
  } catch {
    data = null
  }
  if (!Array.isArray(data)) return []
  const out: AdminUserListItem[] = []
  for (const row of data) {
    const m = mapAdminUserListRow(row)
    if (m) out.push(m)
  }
  return out
}
