import { addDays, startOfMonth, startOfWeek, toDateKey } from "@/features/admin/lib/calendarUtils"

/** 表示用の開始・終了時刻（HH:mm） */
export interface AvailabilitySlot {
  start: string
  end: string
}

/**
 * シフト月表示グリッド（最大6週）に含まれる全日の `date_from` / `date_to`（YYYY-MM-DD）。
 * `GET /api/admin/trainers/{trainer_id}/shifts` のクエリに使う。
 */
export function getShiftCalendarGridDateRange(monthAnchor: Date): {
  dateFrom: string
  dateTo: string
} {
  const monthStart = startOfMonth(monthAnchor)
  const calendarStart = startOfWeek(monthStart)
  const lastDay = addDays(calendarStart, 41)
  return { dateFrom: toDateKey(calendarStart), dateTo: toDateKey(lastDay) }
}
