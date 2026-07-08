import { ADMIN_MENUS_LIST_PATH, adminMenuDetailPath } from "@/constants/adminApi"
import { apiFetch } from "@/lib/api"

export interface AdminMenu {
  menu_id: string
  name: string
  /** 分。API の `duration_minutes` 等から取得 */
  duration_minutes?: number
  /** 料金。API の `price` 等から取得 */
  price?: number
  /** 非公開。未指定は true（公開）とみなす */
  is_public: boolean
  /** アーカイブ済み。未指定は false とみなす */
  is_archived: boolean
}

function parseBool(v: unknown, defaultValue: boolean): boolean {
  if (v === undefined || v === null) return defaultValue
  if (typeof v === "boolean") return v
  if (typeof v === "number") return v !== 0
  if (typeof v === "string") {
    const t = v.trim().toLowerCase()
    if (t === "true" || t === "1") return true
    if (t === "false" || t === "0") return false
  }
  return defaultValue
}

function parseDurationMinutes(r: Record<string, unknown>): number | undefined {
  const raw =
    r.duration_minutes ??
    r.durationMinutes ??
    r.service_duration_minutes ??
    r.serviceDurationMinutes ??
    r.duration_min ??
    r.duration
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.round(raw)
  }
  if (typeof raw === "string" && /^\d+$/.test(raw.trim())) {
    const n = Number(raw.trim())
    if (n > 0) return n
  }
  return undefined
}

function parsePrice(r: Record<string, unknown>): number | undefined {
  const raw = r.price ?? r.menu_price ?? r.amount
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
    return Math.round(raw)
  }
  if (typeof raw === "string" && /^\d+$/.test(raw.trim())) {
    return Math.round(Number(raw.trim()))
  }
  return undefined
}

export function mapMenuRow(o: unknown): AdminMenu | null {
  if (!o || typeof o !== "object") return null
  const r = o as Record<string, unknown>
  const id = String(r.menu_id ?? r.id ?? "").trim()
  const name = String(r.name ?? r.menu_name ?? "").trim()
  if (!id || !name) return null
  const duration_minutes = parseDurationMinutes(r)
  const price = parsePrice(r)
  const is_public = parseBool(r.is_public ?? r.isPublic, true)
  const is_archived = parseBool(r.is_archived ?? r.isArchived, false)
  const base: AdminMenu = { menu_id: id, name, is_public, is_archived }
  if (duration_minutes !== undefined) base.duration_minutes = duration_minutes
  if (price !== undefined) base.price = price
  return base
}

function extractMenuRows(data: unknown): unknown[] {
  if (Array.isArray(data)) return data
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>
    const arr = o.items ?? o.menus ?? o.data ?? o.results
    if (Array.isArray(arr)) return arr
  }
  return []
}

/**
 * `GET /api/admin/menus`（要ログイン Cookie）
 * 非公開・アーカイブ込みの全件。配列または `{ items: [...] }`。
 */
export async function fetchAdminMenus(): Promise<AdminMenu[]> {
  const res = await apiFetch(ADMIN_MENUS_LIST_PATH, { method: "GET" })
  if (res.status === 401) {
    throw new Error("UNAUTHORIZED")
  }
  if (!res.ok) {
    throw new Error("FETCH_FAILED")
  }
  const data = (await res.json()) as unknown
  const out: AdminMenu[] = []
  for (const row of extractMenuRows(data)) {
    const m = mapMenuRow(row)
    if (m) out.push(m)
  }
  return out
}

/** 予約画面など「公開中かつ未アーカイブ」のみに絞る */
export function filterBookableMenus(menus: AdminMenu[]): AdminMenu[] {
  return menus.filter((m) => m.is_public && !m.is_archived)
}

export type AdminMenuCreateInput = {
  name: string
  duration_minutes: number
  price: number
  is_public?: boolean
  is_archived?: boolean
}

export type AdminMenuUpdateInput = {
  name?: string
  duration_minutes?: number
  price?: number
  is_public?: boolean
  is_archived?: boolean
}

async function readErrorDetail(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as unknown
    if (typeof data === "string" && data.trim()) return data.trim()
    if (Array.isArray(data)) {
      const msg = data.map((x) => String(x)).join(", ").trim()
      if (msg) return msg
    }
    if (data && typeof data === "object") {
      const o = data as Record<string, unknown>
      const direct = o.detail ?? o.message ?? o.error
      if (typeof direct === "string" && direct.trim()) return direct.trim()
      if (Array.isArray(direct)) {
        const msgs = direct
          .map((x) => {
            if (typeof x === "string") return x
            if (x && typeof x === "object") {
              const r = x as Record<string, unknown>
              const loc = Array.isArray(r.loc) ? r.loc.join(".") : ""
              const msg = typeof r.msg === "string" ? r.msg : ""
              return [loc, msg].filter(Boolean).join(": ")
            }
            return String(x)
          })
          .filter(Boolean)
          .join(", ")
          .trim()
        if (msgs) return msgs
      }
    }
  } catch {
    try {
      const text = (await res.text()).trim()
      if (text) return text
    } catch {
      // no-op
    }
  }
  return ""
}

function buildCreatePayload(input: AdminMenuCreateInput): Record<string, unknown> {
  const name = input.name.trim()
  const body: Record<string, unknown> = {
    name,
    duration_minutes: Math.round(input.duration_minutes),
    price: Math.round(input.price),
  }
  if (input.is_public !== undefined) body.is_public = input.is_public
  if (input.is_archived !== undefined) body.is_archived = input.is_archived
  return body
}

/**
 * `POST /api/admin/menus` — メニュー作成。
 */
export async function postAdminMenu(input: AdminMenuCreateInput): Promise<AdminMenu> {
  const primary = buildCreatePayload(input)
  const res = await apiFetch(ADMIN_MENUS_LIST_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(primary),
  })
  if (res.status === 401) throw new Error("UNAUTHORIZED")
  if (!res.ok) {
    const detail = await readErrorDetail(res)
    throw new Error(
      detail ? `FETCH_FAILED_${res.status}:${detail}` : `FETCH_FAILED_${res.status}`,
    )
  }
  let data: unknown
  try {
    data = await res.json()
  } catch {
    data = null
  }
  const mapped = mapMenuRow(data)
  if (mapped) return mapped
  const list = await fetchAdminMenus()
  const n = input.name.trim()
  const found = list.find((m) => m.name === n)
  if (found) return found
  throw new Error("INVALID_RESPONSE")
}

/**
 * `PUT /api/admin/menus/{menu_id}` — メニュー更新。
 */
export async function putAdminMenu(
  menuId: string,
  input: AdminMenuUpdateInput,
): Promise<void> {
  const body: Record<string, unknown> = {}
  if (input.name !== undefined) body.name = input.name.trim()
  if (input.is_public !== undefined) body.is_public = input.is_public
  if (input.is_archived !== undefined) body.is_archived = input.is_archived
  if (
    input.duration_minutes !== undefined &&
    Number.isFinite(input.duration_minutes) &&
    input.duration_minutes > 0
  ) {
    body.duration_minutes = Math.round(input.duration_minutes)
  }
  if (
    input.price !== undefined &&
    Number.isFinite(input.price) &&
    input.price >= 0
  ) {
    body.price = Math.round(input.price)
  }
  const res = await apiFetch(adminMenuDetailPath(menuId), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (res.status === 401) throw new Error("UNAUTHORIZED")
  if (!res.ok) {
    const detail = await readErrorDetail(res)
    throw new Error(
      detail ? `FETCH_FAILED_${res.status}:${detail}` : `FETCH_FAILED_${res.status}`,
    )
  }
}
