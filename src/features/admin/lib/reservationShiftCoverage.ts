import type { TrainerShiftRow } from "@/features/admin/api/trainerShiftsApi"
import { rowsToSlots } from "@/features/admin/api/trainerShiftsApi"
import { padTimePart, timeToMinutes } from "@/features/admin/lib/businessHours"
import { isoToMinutesInAdminCalendarTz } from "@/features/admin/lib/calendarUtils"

/**
 * 予約の開始・終了（管理カレンダー TZ の時刻）が、その日のシフト枠のいずれかに完全に含まれるか。
 */
export function reservationFullyWithinTrainerShifts(
  startAtIso: string,
  endAtIso: string,
  rowsForTrainerOnDate: TrainerShiftRow[],
): boolean {
  if (rowsForTrainerOnDate.length === 0) return false
  const slots = rowsToSlots(rowsForTrainerOnDate)
  const rs = isoToMinutesInAdminCalendarTz(startAtIso)
  const re = isoToMinutesInAdminCalendarTz(endAtIso)
  if (re <= rs) return false
  for (const slot of slots) {
    const a = timeToMinutes(padTimePart(slot.start))
    const b = timeToMinutes(padTimePart(slot.end))
    if (rs >= a && re <= b) return true
  }
  return false
}
