import { ADMIN_TRAINERS_LIST_PATH } from "@/constants/adminApi"
import { apiFetch } from "@/lib/api"
import type { Staff } from "@/features/admin/types/staff"

function normalizeTrainerColor(raw: unknown): string {
  const s = typeof raw === "string" ? raw.trim() : ""
  if (/^#[0-9A-Fa-f]{6}$/i.test(s)) return s.toLowerCase()
  if (/^[0-9A-Fa-f]{6}$/i.test(s)) return `#${s.toLowerCase()}`
  return "#64748b"
}

/** `trainers.is_active` — true のときだけ一覧に含める。未指定は true とみなす（後方互換） */
function parseTrainerIsActive(o: Record<string, unknown>): boolean {
  const v = o.is_active ?? o.isActive
  if (v === undefined || v === null) return true
  if (typeof v === "boolean") return v
  if (typeof v === "number") return v === 1
  if (typeof v === "string") {
    const t = v.trim().toLowerCase()
    return t === "1" || t === "true"
  }
  return Boolean(v)
}

function parseTrainerMenuIds(o: Record<string, unknown>): string[] | undefined {
  const raw = o.menu_ids ?? o.menuIds ?? o.menus
  if (!Array.isArray(raw)) return undefined
  const ids: string[] = []
  for (const x of raw) {
    if (typeof x === "string" && x.trim()) {
      ids.push(x.trim())
      continue
    }
    if (x && typeof x === "object") {
      const r = x as Record<string, unknown>
      const id = String(r.menu_id ?? r.id ?? "").trim()
      if (id) ids.push(id)
    }
  }
  return ids.length > 0 ? ids : undefined
}

/** `GET /api/admin/trainers` の各行を `Staff` に（`trainer_id` / `id`・`name`・`color` 等） */
export function mapTrainerRowToStaff(row: unknown): Staff | null {
  if (!row || typeof row !== "object") return null
  const o = row as Record<string, unknown>
  if (!parseTrainerIsActive(o)) return null
  const idRaw = o.trainer_id ?? o.id
  const id = idRaw != null ? String(idRaw) : ""
  const name = typeof o.name === "string" ? o.name.trim() : ""
  if (!id || !name) return null
  const color = normalizeTrainerColor(
    o.color ?? o.display_color ?? o.calendar_color,
  )
  const descRaw = o.description
  const description =
    typeof descRaw === "string" && descRaw.trim()
      ? descRaw.trim()
      : undefined
  const imgRaw = o.image_url ?? o.imageUrl
  const image_url =
    typeof imgRaw === "string" && imgRaw.trim() ? imgRaw.trim() : undefined
  const doRaw = o.display_order ?? o.displayOrder
  let display_order: number | undefined
  if (typeof doRaw === "number" && Number.isFinite(doRaw)) {
    display_order = Math.round(doRaw)
  } else if (typeof doRaw === "string" && /^\d+$/.test(doRaw.trim())) {
    display_order = Math.round(Number(doRaw.trim()))
  }
  const menuIds = parseTrainerMenuIds(o)
  const adminIdRaw = o.admin_id ?? o.adminId
  const adminId =
    typeof adminIdRaw === "string" && adminIdRaw.trim() ? adminIdRaw.trim() : null
  const staff: Staff = { id, name, color, description }
  if (image_url) staff.image_url = image_url
  if (display_order !== undefined) staff.display_order = display_order
  if (menuIds) staff.menuIds = menuIds
  if (adminId) staff.adminId = adminId
  return staff
}

/** `GET …/trainers/{id}` 用。`is_active` による除外はしない */
export function mapTrainerDetailRowToStaff(row: unknown): Staff | null {
  if (!row || typeof row !== "object") return null
  const o = row as Record<string, unknown>
  const idRaw = o.trainer_id ?? o.id
  const id = idRaw != null ? String(idRaw) : ""
  const name = typeof o.name === "string" ? o.name.trim() : ""
  if (!id || !name) return null
  const color = normalizeTrainerColor(
    o.color ?? o.display_color ?? o.calendar_color,
  )
  const descRaw = o.description
  const description =
    typeof descRaw === "string" && descRaw.trim()
      ? descRaw.trim()
      : undefined
  const imgRaw = o.image_url ?? o.imageUrl
  const image_url =
    typeof imgRaw === "string" && imgRaw.trim() ? imgRaw.trim() : undefined
  const doRaw = o.display_order ?? o.displayOrder
  let display_order: number | undefined
  if (typeof doRaw === "number" && Number.isFinite(doRaw)) {
    display_order = Math.round(doRaw)
  } else if (typeof doRaw === "string" && /^\d+$/.test(doRaw.trim())) {
    display_order = Math.round(Number(doRaw.trim()))
  }
  const menuIds = parseTrainerMenuIds(o)
  const adminIdRaw = o.admin_id ?? o.adminId
  const adminId =
    typeof adminIdRaw === "string" && adminIdRaw.trim() ? adminIdRaw.trim() : null
  const staff: Staff = { id, name, color, description }
  if (image_url) staff.image_url = image_url
  if (display_order !== undefined) staff.display_order = display_order
  if (menuIds) staff.menuIds = menuIds
  if (adminId) staff.adminId = adminId
  return staff
}

function extractTrainerRows(data: unknown): unknown[] {
  const out: unknown[] = []
  if (Array.isArray(data)) {
    for (const x of data) {
      if (x && typeof x === "object") out.push(x)
    }
  } else if (data && typeof data === "object") {
    const o = data as Record<string, unknown>
    const arr = o.trainers ?? o.items ?? o.data ?? o.results ?? o.rows
    if (Array.isArray(arr)) {
      for (const x of arr) {
        if (x && typeof x === "object") out.push(x)
      }
    }
  }
  return out
}

/**
 * `GET …/trainers/{id}` の JSON が一覧と異なりラップされる場合に素行へ正規化する。
 * 例: `{ "trainer": { … } }`, `{ "data": { … } }`, 単要素配列 `[ { … } ]`
 */
function unwrapTrainerDetailPayload(data: unknown): unknown {
  let cur: unknown = data
  const seen = new Set<unknown>()
  for (let depth = 0; depth < 8 && cur != null; depth += 1) {
    if (seen.has(cur)) break
    seen.add(cur)
    if (Array.isArray(cur)) {
      const first = cur.find((x) => x && typeof x === "object")
      cur = first ?? cur
      continue
    }
    if (!cur || typeof cur !== "object") break
    const o = cur as Record<string, unknown>
    const nested =
      o.trainer ??
      o.Trainer ??
      o.item ??
      o.record ??
      o.payload ??
      o.result ??
      (o.data && typeof o.data === "object" ? o.data : undefined)
    if (nested && typeof nested === "object") {
      cur = nested
      continue
    }
    break
  }
  return cur
}

/** 詳細 GET が `name` 等を省略して差分だけ返すサーバー向けに一覧行をベースにマージする */
function mergeTrainerDetailFromPartialRow(
  row: unknown,
  fallback: Staff,
  requestedTrainerId: string,
): Staff | null {
  if (!row || typeof row !== "object") return null
  const o = row as Record<string, unknown>
  const idRaw = o.trainer_id ?? o.id
  if (
    idRaw != null &&
    String(idRaw) !== String(fallback.id) &&
    String(idRaw) !== String(requestedTrainerId)
  ) {
    return null
  }
  if (
    idRaw == null &&
    String(fallback.id) !== String(requestedTrainerId)
  ) {
    return null
  }
  const full = mapTrainerDetailRowToStaff(row)
  if (full) return full
  const next: Staff = { ...fallback }
  const descRaw = o.description
  if (typeof descRaw === "string") {
    const t = descRaw.trim()
    next.description = t.length > 0 ? t : undefined
  }
  const imgRaw = o.image_url ?? o.imageUrl
  if (typeof imgRaw === "string") {
    const t = imgRaw.trim()
    next.image_url = t.length > 0 ? t : undefined
  } else if (imgRaw === null) {
    delete next.image_url
  }
  const doRaw = o.display_order ?? o.displayOrder
  if (typeof doRaw === "number" && Number.isFinite(doRaw)) {
    next.display_order = Math.round(doRaw)
  } else if (typeof doRaw === "string" && /^\d+$/.test(doRaw.trim())) {
    next.display_order = Math.round(Number(doRaw.trim()))
  } else if (doRaw === null) {
    delete next.display_order
  }
  const menuIds = parseTrainerMenuIds(o)
  if (menuIds) next.menuIds = menuIds
  else if (o.menu_ids === null || o.menuIds === null) delete next.menuIds
  const colorRaw = o.color ?? o.display_color ?? o.calendar_color
  if (typeof colorRaw === "string" && colorRaw.trim()) {
    next.color = normalizeTrainerColor(colorRaw)
  }
  const nameRaw = o.name
  if (typeof nameRaw === "string" && nameRaw.trim()) {
    next.name = nameRaw.trim()
  }
  return next
}

/**
 * 対象サロンのトレーナー（`is_active` が true / 1 の行のみ。未指定は表示する）。
 * 要 `access_token` Cookie。
 */
export async function fetchAdminTrainers(): Promise<Staff[]> {
  const res = await apiFetch(ADMIN_TRAINERS_LIST_PATH, { method: "GET" })
  if (res.status === 401) {
    throw new Error("UNAUTHORIZED")
  }
  if (!res.ok) {
    throw new Error("FETCH_FAILED")
  }
  let data: unknown
  try {
    data = await res.json()
  } catch {
    data = null
  }
  const rows = extractTrainerRows(data)
  const list: Staff[] = []
  for (const row of rows) {
    const s = mapTrainerRowToStaff(row)
    if (s) list.push(s)
  }
  /**
   * バックエンドが `display_order` 昇順 → `name` 昇順で返しているため、
   * フロントでも同じソート規則を適用する（`display_order` が無いものは末尾）。
   */
  return list.sort((a, b) => {
    const oa = a.display_order ?? Number.MAX_SAFE_INTEGER
    const ob = b.display_order ?? Number.MAX_SAFE_INTEGER
    if (oa !== ob) return oa - ob
    return a.name.localeCompare(b.name, "ja")
  })
}

/**
 * カレンダー絞り込み用のトレーナー名一覧（`fetchAdminTrainers` ベース）。
 */
export async function fetchAdminTrainerNames(): Promise<string[]> {
  const staff = await fetchAdminTrainers()
  return [...new Set(staff.map((s) => s.name.trim()).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, "ja"),
  )
}

function trainerDetailUrl(trainerId: string): string {
  return `${ADMIN_TRAINERS_LIST_PATH}/${encodeURIComponent(trainerId)}`
}

/**
 * `GET /api/admin/trainers/{trainer_id}` — 1件（対応メニュー等の詳細用）。
 * 未実装のサーバーでは 404 となり得る。
 * @param listFallback 一覧で開いた行。詳細 JSON のラップ／部分フィールド時にマージする。
 */
export async function fetchAdminTrainerById(
  trainerId: string,
  listFallback?: Staff,
): Promise<Staff | null> {
  const res = await apiFetch(trainerDetailUrl(trainerId), { method: "GET" })
  if (res.status === 401) throw new Error("UNAUTHORIZED")
  if (res.status === 404) {
    return listFallback && String(listFallback.id) === String(trainerId)
      ? listFallback
      : null
  }
  if (!res.ok) throw new Error("FETCH_FAILED")
  let data: unknown
  try {
    data = await res.json()
  } catch {
    data = null
  }
  const row = unwrapTrainerDetailPayload(data)
  const mapped = mapTrainerDetailRowToStaff(row)
  if (mapped) return mapped
  if (listFallback && String(listFallback.id) === String(trainerId)) {
    const merged = mergeTrainerDetailFromPartialRow(row, listFallback, trainerId)
    if (merged) return merged
    return listFallback
  }
  return null
}

/**
 * `PUT /api/admin/trainers/{trainer_id}` — プロフィール・表示色・対応メニュー等を更新。
 */
export async function putAdminTrainer(
  trainerId: string,
  input: {
    name: string
    color: string
    description?: string
    image_url?: string
    display_order?: number
    /** 省略時は送らない（サーバーが据え置き）。空配列で全解除する用途は配列を明示 */
    menu_ids?: string[]
  },
): Promise<void> {
  const body: Record<string, unknown> = {
    name: input.name.trim(),
    color: input.color.trim(),
  }
  if (input.description !== undefined) {
    const t = input.description.trim()
    body.description = t.length > 0 ? t : null
  }
  if (input.image_url !== undefined) {
    const t = input.image_url.trim()
    body.image_url = t.length > 0 ? t : null
  }
  if (
    input.display_order !== undefined &&
    Number.isFinite(input.display_order)
  ) {
    body.display_order = Math.round(input.display_order)
  }
  if (input.menu_ids !== undefined) {
    body.menu_ids = input.menu_ids.map((id) => String(id).trim()).filter(Boolean)
  }
  const res = await apiFetch(trainerDetailUrl(trainerId), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (res.status === 401) {
    throw new Error("UNAUTHORIZED")
  }
  if (!res.ok) {
    throw new Error("FETCH_FAILED")
  }
}

/**
 * `POST /api/admin/trainers` — トレーナー登録。
 * 対応メニューは `menu_ids` でまとめて送る（サーバー側で `trainer_menus` に紐づく想定）。
 * `display_order` を省略した場合はサーバーが当サロンの最大値+1で採番する想定。
 * `is_active: true` はサーバー側デフォルト。
 */
export async function postAdminTrainer(input: {
  name: string
  color: string
  /** 未入力のときは送らない（NULL 相当） */
  description?: string
  image_url?: string
  display_order?: number
  /** ログインアカウント（admin_users）との紐付け */
  admin_id?: string
  /** 対応メニューID（同一 trainer_id に紐づける） */
  menu_ids?: string[]
}): Promise<Staff> {
  const payload: Record<string, unknown> = {
    name: input.name.trim(),
    color: input.color.trim(),
  }
  const d = input.description?.trim()
  if (d) {
    payload.description = d
  }
  const img = input.image_url?.trim()
  if (img) {
    payload.image_url = img
  }
  if (
    input.display_order !== undefined &&
    Number.isFinite(input.display_order)
  ) {
    payload.display_order = Math.round(input.display_order)
  }
  const adminId = input.admin_id?.trim()
  if (adminId) {
    payload.admin_id = adminId
  }
  const mids = (input.menu_ids ?? [])
    .map((id) => String(id).trim())
    .filter(Boolean)
  if (mids.length > 0) {
    payload.menu_ids = mids
  }

  const res = await apiFetch(ADMIN_TRAINERS_LIST_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (res.status === 401) {
    throw new Error("UNAUTHORIZED")
  }
  if (!res.ok) {
    throw new Error("FETCH_FAILED")
  }
  let data: unknown
  try {
    data = await res.json()
  } catch {
    data = null
  }
  const mapped = mapTrainerRowToStaff(data)
  if (mapped) return mapped
  const list = await fetchAdminTrainers()
  const n = input.name.trim()
  const found = list.find((s) => s.name === n)
  if (found) return found
  throw new Error("INVALID_RESPONSE")
}

/**
 * `PUT /api/admin/trainers/{trainer_id}` で無効化（`is_active: false`）。
 * 編集と同じエンドポイントのため、`name`・`color` も送る（PUT 部分更新でないサーバー向け）。
 * 過去の予約データはサーバー側で保持される想定。
 */
export async function deactivateAdminTrainer(staff: Staff): Promise<void> {
  const res = await apiFetch(trainerDetailUrl(staff.id), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: staff.name.trim(),
      color: staff.color.trim(),
      is_active: false,
    }),
  })
  if (res.status === 401) {
    throw new Error("UNAUTHORIZED")
  }
  if (!res.ok) {
    throw new Error("FETCH_FAILED")
  }
}
