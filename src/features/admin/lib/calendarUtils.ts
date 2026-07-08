import type { Reservation } from "@/features/admin/types/reservation"

/** 管理画面の予約カレンダー・一覧で暦日を揃えるタイムゾーン（API が UTC で返す場合も JST の「何日」で表示する） */
export const ADMIN_CALENDAR_TIME_ZONE = "Asia/Tokyo" as const

const JST_OFFSET_MS = 9 * 60 * 60 * 1000

export function toLocalDate(iso: string): Date {
  const d = new Date(iso)
  return new Date(d.getTime() + d.getTimezoneOffset() * 60 * 1000 + JST_OFFSET_MS)
}

export function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function endOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export function addWeeks(d: Date, n: number): Date {
  return addDays(d, n * 7)
}

export function addMonths(d: Date, n: number): Date {
  const x = new Date(d)
  x.setMonth(x.getMonth() + n)
  return x
}

export function startOfWeek(d: Date): Date {
  const x = new Date(d)
  const day = x.getDay()
  const diff = day === 0 ? -6 : 1 - day
  return startOfDay(addDays(x, diff))
}

export function startOfMonth(d: Date): Date {
  const x = new Date(d)
  x.setDate(1)
  return startOfDay(x)
}

export function endOfMonth(d: Date): Date {
  const x = new Date(d)
  x.setMonth(x.getMonth() + 1)
  x.setDate(0)
  return endOfDay(x)
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function isInRange(date: Date, start: Date, end: Date): boolean {
  const t = date.getTime()
  return t >= start.getTime() && t <= end.getTime()
}

/** 日付を YYYY-MM-DD 形式にする（ローカル日付） */
export function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** 指定タイムゾーンにおける暦日の YYYY-MM-DD（例: 日本時間の「今日」） */
export function getDateKeyInTimeZone(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d)
}

/** ISO 日時を指定タイムゾーンの暦日キーに変換 */
export function getIsoDateKeyInTimeZone(iso: string, timeZone: string): string {
  return getDateKeyInTimeZone(new Date(iso), timeZone)
}

/**
 * ISO 日時を `timeZone` の「その日の 0 時からの経過分」（0〜1439）に変換。
 * シフトの HH:mm と比較する際に `ADMIN_CALENDAR_TIME_ZONE` と揃える。
 */
export function isoToMinutesInTimeZone(iso: string, timeZone: string): number {
  const d = new Date(iso)
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(d)
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0)
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0)
  return hour * 60 + minute
}

/** 管理カレンダーと同じタイムゾーンでの「分」表現 */
export function isoToMinutesInAdminCalendarTz(iso: string): number {
  return isoToMinutesInTimeZone(iso, ADMIN_CALENDAR_TIME_ZONE)
}

/**
 * `YYYY-MM-DD` と `HH:mm`（または `HH:mm:ss`）を組み合わせ、管理カレンダー TZ（JST）の瞬間を表す ISO 8601（UTC）に変換。
 */
export function combineDateAndTimeToAdminTzIso(
  dateYmd: string,
  timeHm: string,
): string {
  const t = timeHm.length === 5 ? `${timeHm}:00` : timeHm
  return new Date(`${dateYmd}T${t}+09:00`).toISOString()
}

/** ISO 開始時刻から指定分後の終了時刻（UTC ISO） */
export function addMinutesToIso(startIso: string, minutes: number): string {
  return new Date(new Date(startIso).getTime() + minutes * 60_000).toISOString()
}

/** 管理カレンダー TZ での時刻を `HH:mm` で返す（`input type="time"` の min 等に使用） */
export function formatTimeHmInAdminTz(iso: string): string {
  const d = new Date(iso)
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ADMIN_CALENDAR_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d)
  const h = parts.find((p) => p.type === "hour")?.value ?? "00"
  const m = parts.find((p) => p.type === "minute")?.value ?? "00"
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`
}

/**
 * 基準時刻 `notBeforeIso` より前にならないよう `{ dateYmd, timeHm }` を調整（壁時計は JST）。
 */
export function ensureSlotNotBeforeAdminTz(
  dateYmd: string,
  timeHm: string,
  notBeforeIso: string,
): { dateYmd: string; timeHm: string } {
  const slotIso = combineDateAndTimeToAdminTzIso(dateYmd, timeHm)
  if (new Date(slotIso).getTime() >= new Date(notBeforeIso).getTime()) {
    return { dateYmd, timeHm }
  }
  const minYmd = getDateKeyInTimeZone(new Date(notBeforeIso), ADMIN_CALENDAR_TIME_ZONE)
  const minTime = formatTimeHmInAdminTz(notBeforeIso)
  return { dateYmd: minYmd, timeHm: minTime }
}

/** 基準時刻の直後を 15 分単位に切り上げた日付・時刻（新規予約の初期値用） */
export function defaultNextReservationSlotAdminTz(
  notBeforeIso: string,
): { dateYmd: string; timeHm: string } {
  const stepMs = 15 * 60_000
  const t = Math.ceil(new Date(notBeforeIso).getTime() / stepMs) * stepMs
  const d = new Date(t)
  return {
    dateYmd: getDateKeyInTimeZone(d, ADMIN_CALENDAR_TIME_ZONE),
    timeHm: formatTimeHmInAdminTz(d.toISOString()),
  }
}

/** 予約の startAt を指定 TZ の暦日 YYYY-MM-DD に変換（UTC の `...T23:00:00Z` は JST では翌日になるなど） */
function getReservationDateKey(startAt: string): string {
  return getIsoDateKeyInTimeZone(startAt, ADMIN_CALENDAR_TIME_ZONE)
}

export function getReservationsForDay(reservations: Reservation[], day: Date): Reservation[] {
  const dayKey = getDateKeyInTimeZone(day, ADMIN_CALENDAR_TIME_ZONE)
  return reservations.filter((r) => {
    if (r.status === "CANCELLED") return false
    return getReservationDateKey(r.startAt) === dayKey
  })
}

export function getReservationsInRange(
  reservations: Reservation[],
  rangeStart: Date,
  rangeEnd: Date,
): Reservation[] {
  const startKey = getDateKeyInTimeZone(rangeStart, ADMIN_CALENDAR_TIME_ZONE)
  const endKey = getDateKeyInTimeZone(rangeEnd, ADMIN_CALENDAR_TIME_ZONE)
  return reservations.filter((r) => {
    if (r.status === "CANCELLED") return false
    const key = getReservationDateKey(r.startAt)
    return key >= startKey && key <= endKey
  })
}

export function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", hour12: false })
}

/** `formatTime` と同じ表記だが、暦日・シフト判定と揃えて `ADMIN_CALENDAR_TIME_ZONE` で表示 */
export function formatTimeInAdminCalendarTz(iso: string): string {
  return new Date(iso).toLocaleTimeString("ja-JP", {
    timeZone: ADMIN_CALENDAR_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

export function formatTimeRange(startIso: string, endIso: string): string {
  return `${formatTime(startIso)}-${formatTime(endIso)}`
}

/**
 * 日・週タイムラインの予約ブロックで、時間帯＋予約者を1行にまとめるか。
 * 短いブロックや高さが足りないときは true。
 */
export function isCompactReservationTimelineBlock(
  durationMinutes: number,
  heightPercent: number,
): boolean {
  return durationMinutes <= 50 || heightPercent <= 5.5
}

export function formatTimeRangeInAdminCalendarTz(startIso: string, endIso: string): string {
  return `${formatTimeInAdminCalendarTz(startIso)}〜${formatTimeInAdminCalendarTz(endIso)}`
}

/** 開始・終了 ISO から所要時間を日本語で表示（例: 45分 / 1時間30分） */
export function formatReservationDurationJa(startIso: string, endIso: string): string {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime()
  if (!Number.isFinite(ms) || ms <= 0) return "—"
  const totalMin = Math.round(ms / 60_000)
  if (totalMin < 60) return `${totalMin}分`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return m === 0 ? `${h}時間` : `${h}時間${m}分`
}

export function formatDateJa(d: Date): string {
  return d.toLocaleDateString("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "short",
  })
}

/** 日本語の日付表示（指定タイムゾーンの暦日。ダッシュボードの「本日」表記用） */
export function formatDateJaInTimeZone(d: Date, timeZone: string): string {
  return d.toLocaleDateString("ja-JP", {
    timeZone,
    month: "long",
    day: "numeric",
    weekday: "short",
  })
}

/**
 * `startOfWeek`（月曜始まり）の列順と一致させる（0=月 … 6=日）。
 * `business_hours.day_of_week`（0=月…6=日）とも同じ並び。
 */
export const WEEKDAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"]
