import {
  ADMIN_CALENDAR_TIME_ZONE,
  getDateKeyInTimeZone,
  startOfMonth,
} from "@/features/admin/lib/calendarUtils"

/** 管理カレンダー（JST）における「今日」の YYYY-MM-DD */
export function getShiftCalendarTodayKey(now: Date = new Date()): string {
  return getDateKeyInTimeZone(now, ADMIN_CALENDAR_TIME_ZONE)
}

/** シフトを登録・変更できる日か（当日以降） */
export function isShiftRegisterableDateKey(
  dateKey: string,
  todayKey: string = getShiftCalendarTodayKey(),
): boolean {
  return dateKey >= todayKey
}

export function isShiftRegisterableDay(
  day: Date,
  todayKey: string = getShiftCalendarTodayKey(),
): boolean {
  return isShiftRegisterableDateKey(
    getDateKeyInTimeZone(day, ADMIN_CALENDAR_TIME_ZONE),
    todayKey,
  )
}

/** カレンダー表示中の月が JST の当月か */
export function isViewingShiftCalendarCurrentMonth(
  viewDate: Date,
  todayKey: string = getShiftCalendarTodayKey(),
): boolean {
  const viewMonthKey = getDateKeyInTimeZone(
    startOfMonth(viewDate),
    ADMIN_CALENDAR_TIME_ZONE,
  ).slice(0, 7)
  return viewMonthKey === todayKey.slice(0, 7)
}
