import type { BusinessHoursItem } from "@/features/admin/api/adminSettingsApi"
import {
  ADMIN_CALENDAR_TIME_ZONE,
  combineDateAndTimeToAdminTzIso,
  getDateKeyInTimeZone,
} from "@/features/admin/lib/calendarUtils"
import {
  buildStartTimeOptions,
  getBusinessHoursForJsDate,
  padTimePart,
  timeToMinutes,
} from "@/features/admin/lib/businessHours"

export const DEFAULT_ADMIN_NEW_RESERVATION_SLOT_MINUTES = 15

function dateYmdToJsDate(dateYmd: string): Date {
  return new Date(`${dateYmd}T12:00:00+09:00`)
}

function addDaysToDateYmd(dateYmd: string, days: number): string {
  const d = dateYmdToJsDate(dateYmd)
  d.setDate(d.getDate() + days)
  return getDateKeyInTimeZone(d, ADMIN_CALENDAR_TIME_ZONE)
}

function isHolidayDate(
  dateYmd: string,
  holidayDateKeys: ReadonlySet<string> | undefined,
): boolean {
  return holidayDateKeys != null && holidayDateKeys.has(dateYmd)
}

/**
 * 指定日の有効な開始時刻候補（昇順）。
 * - 営業時間内かつ `slot_increment_minutes` の刻み
 * - `now` より後（予約締切 `booking_deadline_minutes` は適用しない）
 * - メニュー所要時間がある場合は終了が営業終了を超えない
 */
export function buildAdminNewReservationStartSlots(
  dateYmd: string,
  businessHoursItems: BusinessHoursItem[],
  holidayDateKeys: ReadonlySet<string> | undefined,
  slotIncrementMinutes: number,
  now: Date = new Date(),
  durationMinutes?: number,
): string[] {
  if (isHolidayDate(dateYmd, holidayDateKeys)) return []

  const biz = getBusinessHoursForJsDate(businessHoursItems, dateYmdToJsDate(dateYmd))
  if (!biz || biz.isClosed) return []

  const bizEndMin = timeToMinutes(biz.end)
  const duration =
    durationMinutes != null && durationMinutes > 0
      ? durationMinutes
      : slotIncrementMinutes

  const allSlots = buildStartTimeOptions(
    biz.start,
    biz.end,
    slotIncrementMinutes,
  ).filter((hm) => timeToMinutes(hm) + duration <= bizEndMin)

  const nowMs = now.getTime()
  return allSlots.filter((hm) => {
    const slotIso = combineDateAndTimeToAdminTzIso(dateYmd, hm)
    return new Date(slotIso).getTime() > nowMs
  })
}

/** 代理新規予約の初期値: 現在時刻より後で最初の有効枠 */
export function defaultAdminNewReservationSlot(
  businessHoursItems: BusinessHoursItem[],
  holidayDateKeys: ReadonlySet<string> | undefined,
  slotIncrementMinutes: number,
  now: Date = new Date(),
  durationMinutes?: number,
  searchDays = 60,
): { dateYmd: string; timeHm: string } | null {
  const startYmd = getDateKeyInTimeZone(now, ADMIN_CALENDAR_TIME_ZONE)
  for (let offset = 0; offset <= searchDays; offset++) {
    const dateYmd = addDaysToDateYmd(startYmd, offset)
    const slots = buildAdminNewReservationStartSlots(
      dateYmd,
      businessHoursItems,
      holidayDateKeys,
      slotIncrementMinutes,
      now,
      durationMinutes,
    )
    if (slots.length > 0) {
      return { dateYmd, timeHm: slots[0] }
    }
  }
  return null
}

/**
 * 入力時刻を有効枠に丸め上げる。
 * 当日に枠が無い・休業の場合は次の営業日の最初の枠へ進める。
 */
export function snapAdminNewReservationSlot(
  dateYmd: string,
  timeHm: string,
  businessHoursItems: BusinessHoursItem[],
  holidayDateKeys: ReadonlySet<string> | undefined,
  slotIncrementMinutes: number,
  now: Date = new Date(),
  durationMinutes?: number,
  searchDays = 60,
): { dateYmd: string; timeHm: string } | null {
  const inputMin = timeToMinutes(padTimePart(timeHm))
  const startYmd = dateYmd < getDateKeyInTimeZone(now, ADMIN_CALENDAR_TIME_ZONE)
    ? getDateKeyInTimeZone(now, ADMIN_CALENDAR_TIME_ZONE)
    : dateYmd

  for (let offset = 0; offset <= searchDays; offset++) {
    const candidateYmd = addDaysToDateYmd(startYmd, offset)
    const slots = buildAdminNewReservationStartSlots(
      candidateYmd,
      businessHoursItems,
      holidayDateKeys,
      slotIncrementMinutes,
      now,
      durationMinutes,
    )
    if (slots.length === 0) continue

    const minForDay = offset === 0 && candidateYmd === dateYmd ? inputMin : -1
    const picked =
      minForDay >= 0
        ? slots.find((hm) => timeToMinutes(hm) >= minForDay)
        : slots[0]
    if (picked) {
      return { dateYmd: candidateYmd, timeHm: picked }
    }
  }
  return null
}

/** 時刻が有効枠に含まれるか */
export function isAdminNewReservationStartSlot(
  dateYmd: string,
  timeHm: string,
  businessHoursItems: BusinessHoursItem[],
  holidayDateKeys: ReadonlySet<string> | undefined,
  slotIncrementMinutes: number,
  now: Date = new Date(),
  durationMinutes?: number,
): boolean {
  const slots = buildAdminNewReservationStartSlots(
    dateYmd,
    businessHoursItems,
    holidayDateKeys,
    slotIncrementMinutes,
    now,
    durationMinutes,
  )
  return slots.includes(padTimePart(timeHm))
}
