import { ADMIN_SETTINGS_PATH } from "@/constants/adminApi"
import { apiFetch } from "@/lib/api"

/** `GET /api/admin/settings` の `business_hours` の1行（`day_of_week`: 0=月…6=日） */
export type BusinessHoursItem = {
  day_of_week: number
  start_time: string
  end_time: string
  is_closed: boolean
}

export type AdminSettingsOut = {
  business_hours: BusinessHoursItem[]
  /** `holidays` テーブルの定休日（YYYY-MM-DD） */
  holidays: string[]
}

function parseHolidayDates(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const x of raw) {
    if (typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x)) {
      out.push(x)
      continue
    }
    if (x && typeof x === "object") {
      const o = x as Record<string, unknown>
      const d = o.date ?? o.holiday_date ?? o.holidayDate
      if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) out.push(d)
    }
  }
  return [...new Set(out)]
}

function parseBusinessHoursArray(raw: unknown): BusinessHoursItem[] {
  if (!Array.isArray(raw)) return []
  const business_hours: BusinessHoursItem[] = []
  for (const row of raw) {
    if (!row || typeof row !== "object") continue
    const r = row as Record<string, unknown>
    const dow = r.day_of_week ?? r.dayOfWeek
    const st = r.start_time ?? r.startTime
    const et = r.end_time ?? r.endTime
    const closed = r.is_closed ?? r.isClosed
    if (typeof dow !== "number" || typeof st !== "string" || typeof et !== "string") continue
    business_hours.push({
      day_of_week: dow,
      start_time: String(st).slice(0, 5),
      end_time: String(et).slice(0, 5),
      is_closed: Boolean(closed),
    })
  }
  return business_hours
}

async function throwIfSettingsFetchUnauthorized(res: Response): Promise<void> {
  if (res.status === 401) {
    throw new Error("UNAUTHORIZED")
  }
  if (!res.ok) {
    throw new Error("FETCH_FAILED")
  }
}

/**
 * `GET /api/admin/settings/business-hours` — `business_hours` テーブルの曜日ごと営業時間。
 */
export async function fetchAdminBusinessHours(): Promise<BusinessHoursItem[]> {
  const res = await apiFetch(`${ADMIN_SETTINGS_PATH}/business-hours`, { method: "GET" })
  await throwIfSettingsFetchUnauthorized(res)
  const data = (await res.json()) as unknown
  return parseBusinessHoursArray(data)
}

/**
 * `GET /api/admin/settings/holidays` — `holidays` テーブルの定休日（YYYY-MM-DD）。
 */
export async function fetchAdminHolidays(): Promise<string[]> {
  const res = await apiFetch(`${ADMIN_SETTINGS_PATH}/holidays`, { method: "GET" })
  await throwIfSettingsFetchUnauthorized(res)
  const data = (await res.json()) as unknown
  return parseHolidayDates(data)
}

/**
 * `GET /api/admin/settings` — `business_hours`（曜日ごとの営業時間）と `holidays`（定休日 YYYY-MM-DD）を含む。
 */
export async function fetchAdminSettings(): Promise<AdminSettingsOut> {
  const res = await apiFetch(ADMIN_SETTINGS_PATH, { method: "GET" })
  await throwIfSettingsFetchUnauthorized(res)
  const data = (await res.json()) as unknown
  if (!data || typeof data !== "object") {
    return { business_hours: [], holidays: [] }
  }
  const o = data as Record<string, unknown>
  const holidays = parseHolidayDates(o.holidays ?? o.holidayDates)
  const raw = o.business_hours ?? o.businessHours
  return {
    business_hours: parseBusinessHoursArray(raw),
    holidays,
  }
}

/** `PUT /api/admin/settings/business-hours` のリクエストアイテム。 */
export type BusinessHoursUpdateItem = BusinessHoursItem

export type BusinessHoursUpdateResult =
  | { kind: "ok" }
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

/**
 * `PUT /api/admin/settings/business-hours` — 曜日ごとの営業時間を一括 upsert。
 * バックエンド: `app/api/admin/settings.py::update_business_hours`
 *
 * 仕様メモ:
 * - `hours` は7曜日（月〜日）分すべてを送るのが想定
 * - 既存があれば UPDATE、無ければ INSERT
 */
export async function putBusinessHours(
  hours: BusinessHoursUpdateItem[],
): Promise<BusinessHoursUpdateResult> {
  try {
    const res = await apiFetch(`${ADMIN_SETTINGS_PATH}/business-hours`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hours }),
    })
    if (res.ok) return { kind: "ok" }
    if (res.status === 401) return { kind: "unauthorized" }
    let detailString: string | undefined
    try {
      const data = (await res.clone().json()) as { detail?: unknown } | null
      detailString = readableDetail(data?.detail)
    } catch {
      // non-JSON body
    }
    return { kind: "error", status: res.status, message: detailString }
  } catch {
    return { kind: "error" }
  }
}

export type HolidayCreateInput = {
  /** YYYY-MM-DD */
  date: string
  description?: string | null
}

export type HolidayCreated = {
  id: string
  date: string
  description: string | null
}

export type HolidayCreateResult =
  | { kind: "ok"; holiday: HolidayCreated }
  | { kind: "unauthorized" }
  | { kind: "error"; status?: number; message?: string }

/**
 * `POST /api/admin/settings/holidays` — 個別の休業日を1件作成。
 * バックエンド: `app/api/admin/settings.py::create_holiday`
 */
/** `GET /api/admin/settings` の `booking_rules` 相当 */
export type BookingRulesOut = {
  allow_same_day: boolean
  booking_deadline_minutes: number
  buffer_minutes: number
  slot_increment_minutes: number
  cancellation_deadline_hours: number
  max_advance_days: number
}

/** `PUT /api/admin/settings/booking-rules` のリクエストボディ */
export type BookingRulesUpdateInput = {
  allow_same_day?: boolean
  booking_deadline_minutes?: number
  buffer_minutes?: number
  slot_increment_minutes?: number
  cancellation_deadline_hours?: number
  max_advance_days?: number
}

export type BookingRulesUpdateResult =
  | { kind: "ok" }
  | { kind: "unauthorized" }
  | { kind: "error"; status?: number; message?: string }

function parseBookingRules(raw: unknown): BookingRulesOut | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const allow =
    typeof o.allow_same_day === "boolean"
      ? o.allow_same_day
      : typeof o.allowSameDay === "boolean"
        ? o.allowSameDay
        : null
  const deadline = o.booking_deadline_minutes ?? o.bookingDeadlineMinutes
  const buffer = o.buffer_minutes ?? o.bufferMinutes ?? o.buffer_times
  const slot = o.slot_increment_minutes ?? o.slotIncrementMinutes
  const cancelH = o.cancellation_deadline_hours ?? o.cancellationDeadlineHours
  const maxDays = o.max_advance_days ?? o.maxAdvanceDays
  if (
    allow === null ||
    typeof deadline !== "number" ||
    typeof buffer !== "number" ||
    typeof slot !== "number" ||
    typeof cancelH !== "number" ||
    typeof maxDays !== "number"
  ) {
    return null
  }
  return {
    allow_same_day: allow,
    booking_deadline_minutes: deadline,
    buffer_minutes: buffer,
    slot_increment_minutes: slot,
    cancellation_deadline_hours: cancelH,
    max_advance_days: maxDays,
  }
}

/** `GET /api/admin/settings` から予約ルールのみ取得（未設定時は null） */
export async function fetchAdminBookingRules(): Promise<BookingRulesOut | null> {
  try {
    const res = await apiFetch(ADMIN_SETTINGS_PATH, { method: "GET" })
    if (res.status === 401) throw new Error("UNAUTHORIZED")
    if (res.status === 404) return null
    if (!res.ok) return null
    const data = (await res.json()) as { booking_rules?: unknown }
    return parseBookingRules(data.booking_rules)
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") throw e
    return null
  }
}

function isBookingRulesNotConfiguredMessage(message: string | undefined): boolean {
  if (!message) return false
  return message.includes("予約ルールが設定されていません")
}

async function requestBookingRules(
  method: "PUT" | "POST",
  payload: BookingRulesUpdateInput,
): Promise<{ ok: boolean; status: number; detailString?: string }> {
  const res = await apiFetch(`${ADMIN_SETTINGS_PATH}/booking-rules`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  let detailString: string | undefined
  try {
    const data = (await res.clone().json()) as { detail?: unknown } | null
    detailString = readableDetail(data?.detail)
  } catch {
    // non-JSON body
  }
  return { ok: res.ok, status: res.status, detailString }
}

/**
 * 予約ルールを保存する。
 * - 既存行がある API: `PUT /api/admin/settings/booking-rules`
 * - 未作成の API（Docker 実装など）: 初回は `POST`、2回目以降は `PUT`
 */
export async function putBookingRules(
  payload: BookingRulesUpdateInput,
): Promise<BookingRulesUpdateResult> {
  try {
    const put = await requestBookingRules("PUT", payload)
    if (put.ok) return { kind: "ok" }
    if (put.status === 401) return { kind: "unauthorized" }

    if (put.status === 404 && isBookingRulesNotConfiguredMessage(put.detailString)) {
      const post = await requestBookingRules("POST", payload)
      if (post.ok) return { kind: "ok" }
      if (post.status === 401) return { kind: "unauthorized" }
      if (post.status === 409) {
        const retryPut = await requestBookingRules("PUT", payload)
        if (retryPut.ok) return { kind: "ok" }
        if (retryPut.status === 401) return { kind: "unauthorized" }
        return {
          kind: "error",
          status: retryPut.status,
          message: retryPut.detailString,
        }
      }
      return { kind: "error", status: post.status, message: post.detailString }
    }

    return { kind: "error", status: put.status, message: put.detailString }
  } catch {
    return { kind: "error" }
  }
}

export async function postHoliday(
  input: HolidayCreateInput,
): Promise<HolidayCreateResult> {
  try {
    const res = await apiFetch(`${ADMIN_SETTINGS_PATH}/holidays`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: input.date,
        description: input.description?.trim() ? input.description.trim() : null,
      }),
    })
    let detailString: string | undefined
    try {
      const data = (await res.clone().json()) as
        | { detail?: unknown; id?: unknown; date?: unknown; description?: unknown }
        | null
      detailString = readableDetail(data?.detail)
      if (res.ok && data) {
        const id = typeof data.id === "string" ? data.id : ""
        const date = typeof data.date === "string" ? data.date.slice(0, 10) : input.date
        const description =
          typeof data.description === "string" ? data.description : null
        return { kind: "ok", holiday: { id, date, description } }
      }
    } catch {
      // non-JSON body
    }
    if (res.status === 401) return { kind: "unauthorized" }
    return { kind: "error", status: res.status, message: detailString }
  } catch {
    return { kind: "error" }
  }
}
