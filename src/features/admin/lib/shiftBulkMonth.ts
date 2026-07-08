import type { BusinessHoursItem } from "@/features/admin/api/adminSettingsApi"
import type { TrainerShiftRow } from "@/features/admin/api/trainerShiftsApi"
import { normalizeShiftTime } from "@/features/admin/api/trainerShiftsApi"
import {
  ADMIN_CALENDAR_TIME_ZONE,
  addDays,
  endOfMonth,
  getDateKeyInTimeZone,
  startOfMonth,
} from "@/features/admin/lib/calendarUtils"
import {
  getBusinessHoursForJsDate,
  jsDateToApiDayOfWeek,
  padTimePart,
  shiftSlotWithinBusinessHours,
  type BusinessWindowForDay,
} from "@/features/admin/lib/businessHours"
import {
  getShiftCalendarTodayKey,
  isShiftRegisterableDateKey,
} from "@/features/admin/lib/shiftDatePolicy"
import { getReservationsOutsideShiftWindow } from "@/features/admin/lib/shiftReservationConflict"
import type { AvailabilitySlot } from "@/features/admin/lib/shiftAvailability"
import type { Reservation } from "@/features/admin/types/reservation"

export type BulkMonthDayAction =
  | { type: "create"; dateKey: string; day: Date; slot: AvailabilitySlot }
  | {
      type: "update"
      dateKey: string
      day: Date
      slot: AvailabilitySlot
      primaryShiftId: string
      extraShiftIds: string[]
    }
  | { type: "skip"; dateKey: string; reason: string }

export type BulkMonthPlan = {
  actions: BulkMonthDayAction[]
  createCount: number
  updateCount: number
  skipCount: number
}

export function iterateDaysInMonth(monthAnchor: Date): Date[] {
  const start = startOfMonth(monthAnchor)
  const end = endOfMonth(monthAnchor)
  const days: Date[] = []
  let d = start
  while (d.getTime() <= end.getTime()) {
    days.push(new Date(d.getTime()))
    d = addDays(d, 1)
  }
  return days
}

/** 営業している曜日（API day_of_week 0=月…6=日）のデフォルト選択 */
export function defaultWeekdayMask(businessHoursItems: BusinessHoursItem[]): Set<number> {
  const open = new Set<number>()
  for (const row of businessHoursItems) {
    if (!row.is_closed) open.add(row.day_of_week)
  }
  if (open.size === 0) {
    for (let i = 0; i < 7; i++) open.add(i)
  }
  return open
}

/** 営業日の代表時間（最初に見つかった営業曜日） */
export function defaultBulkSlot(
  businessHoursItems: BusinessHoursItem[],
): AvailabilitySlot {
  for (let dow = 0; dow < 7; dow++) {
    const row = businessHoursItems.find((h) => h.day_of_week === dow && !h.is_closed)
    if (row) {
      return {
        start: padTimePart(row.start_time),
        end: padTimePart(row.end_time),
      }
    }
  }
  return { start: "10:00", end: "19:00" }
}

function existingMatchesSlot(rows: TrainerShiftRow[], slot: AvailabilitySlot): boolean {
  if (rows.length !== 1) return false
  const r = rows[0]
  return (
    normalizeShiftTime(r.start_time) === slot.start &&
    normalizeShiftTime(r.end_time) === slot.end
  )
}

export function buildBulkMonthPlan(params: {
  monthAnchor: Date
  trainerId: string
  slot: AvailabilitySlot
  weekdayMask: ReadonlySet<number>
  businessHoursItems: BusinessHoursItem[]
  holidayDateKeys: ReadonlySet<string>
  apiShiftRows: Record<string, TrainerShiftRow[] | undefined>
  reservations: Reservation[]
  reservationsReady: boolean
}): BulkMonthPlan {
  const {
    monthAnchor,
    trainerId,
    slot,
    weekdayMask,
    businessHoursItems,
    holidayDateKeys,
    apiShiftRows,
    reservations,
    reservationsReady,
  } = params

  const actions: BulkMonthDayAction[] = []
  let createCount = 0
  let updateCount = 0
  let skipCount = 0
  const todayKey = getShiftCalendarTodayKey()

  for (const day of iterateDaysInMonth(monthAnchor)) {
    const dateKey = getDateKeyInTimeZone(day, ADMIN_CALENDAR_TIME_ZONE)

    if (!isShiftRegisterableDateKey(dateKey, todayKey)) {
      actions.push({ type: "skip", dateKey, reason: "過去日" })
      skipCount++
      continue
    }

    if (holidayDateKeys.has(dateKey)) {
      actions.push({ type: "skip", dateKey, reason: "定休日" })
      skipCount++
      continue
    }

    const dow = jsDateToApiDayOfWeek(day)
    if (!weekdayMask.has(dow)) {
      actions.push({ type: "skip", dateKey, reason: "対象曜日外" })
      skipCount++
      continue
    }

    const biz: BusinessWindowForDay | null = getBusinessHoursForJsDate(businessHoursItems, day)
    if (!biz || biz.isClosed) {
      actions.push({ type: "skip", dateKey, reason: "曜日休業" })
      skipCount++
      continue
    }

    if (!shiftSlotWithinBusinessHours(slot, { start: biz.start, end: biz.end })) {
      actions.push({
        type: "skip",
        dateKey,
        reason: `営業時間外（${biz.start}〜${biz.end}）`,
      })
      skipCount++
      continue
    }

    if (!reservationsReady) {
      actions.push({ type: "skip", dateKey, reason: "予約情報未取得" })
      skipCount++
      continue
    }

    const outside = getReservationsOutsideShiftWindow(
      reservations,
      trainerId,
      day,
      slot.start,
      slot.end,
    )
    if (outside.length > 0) {
      actions.push({ type: "skip", dateKey, reason: "予約と時間が重なる" })
      skipCount++
      continue
    }

    const rows = apiShiftRows[dateKey] ?? []
    if (existingMatchesSlot(rows, slot)) {
      actions.push({ type: "skip", dateKey, reason: "既に同じシフト" })
      skipCount++
      continue
    }

    if (rows.length === 0) {
      actions.push({ type: "create", dateKey, day, slot })
      createCount++
    } else {
      actions.push({
        type: "update",
        dateKey,
        day,
        slot,
        primaryShiftId: rows[0].shift_id,
        extraShiftIds: rows.slice(1).map((r) => r.shift_id),
      })
      updateCount++
    }
  }

  return { actions, createCount, updateCount, skipCount }
}
