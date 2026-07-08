import type { BusinessHoursItem } from "@/features/admin/api/adminSettingsApi"
import { getBusinessHoursForJsDate } from "@/features/admin/lib/businessHours"
import {
  ADMIN_CALENDAR_TIME_ZONE,
  startOfMonth,
  endOfMonth,
  addDays,
  startOfWeek,
  getReservationsForDay,
  WEEKDAY_LABELS,
  formatTimeRange,
  startOfDay,
  getDateKeyInTimeZone,
} from "@/features/admin/lib/calendarUtils"
import type { Reservation } from "@/features/admin/types/reservation"
import type { Staff } from "@/features/admin/types/staff"
import { getReservationTrainerColor } from "@/features/admin/hooks/useStaff"

interface CalendarMonthViewProps {
  date: Date
  reservations: Reservation[]
  staffList: Staff[]
  onSelectReservation: (r: Reservation) => void
  onSelectDay?: (day: Date) => void
  /** `GET /api/admin/settings` の `holidays`（YYYY-MM-DD） */
  holidayDateKeys?: ReadonlySet<string>
  /** `GET /api/admin/settings` の `business_hours`（曜日ごとの休業） */
  businessHoursItems?: BusinessHoursItem[]
}

function sortByStartTime(list: Reservation[]): Reservation[] {
  return [...list].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
  )
}

export function CalendarMonthView({
  date,
  reservations,
  staffList,
  onSelectReservation,
  onSelectDay,
  holidayDateKeys,
  businessHoursItems,
}: CalendarMonthViewProps) {
  const monthStart = startOfMonth(date)
  const monthEnd = endOfMonth(date)
  const calendarStart = startOfWeek(monthStart)
  const weeks: Date[][] = []
  let current = calendarStart
  /** 対象月の末日をまたぐまでの週だけ表示（4〜6週で可変）。 */
  while (current <= monthEnd) {
    const week: Date[] = []
    for (let i = 0; i < 7; i++) {
      week.push(current)
      current = addDays(current, 1)
    }
    weeks.push(week)
  }

  const isCurrentMonth = (d: Date) => d.getMonth() === date.getMonth()

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[320px]">
        <div className="grid grid-cols-7 border border-border">
          {WEEKDAY_LABELS.map((label, i) => (
            <div
              key={label}
              className={`border-b border-border py-1.5 text-center text-xs font-medium ${
                i === 6
                  ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400"
                  : i === 5
                    ? "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400"
                    : "bg-muted/50 text-muted-foreground"
              }`}
            >
              {label}
            </div>
          ))}
          {weeks.flat().map((day) => {
            const dayReservations = sortByStartTime(
              getReservationsForDay(reservations, day),
            )
            const inMonth = isCurrentMonth(day)
            const dateKey = getDateKeyInTimeZone(day, ADMIN_CALENDAR_TIME_ZONE)
            const isHoliday =
              holidayDateKeys != null &&
              holidayDateKeys.size > 0 &&
              holidayDateKeys.has(dateKey)
            const biz =
              businessHoursItems != null && businessHoursItems.length > 0
                ? getBusinessHoursForJsDate(businessHoursItems, day)
                : null
            const isWeekdayClosed = biz?.isClosed === true
            return (
              <div
                key={day.toISOString()}
                className={`min-h-[100px] border-b border-r border-border p-1 last:border-r-0 ${
                  inMonth ? "bg-background" : "bg-muted/20"
                } ${isHoliday ? "bg-amber-50/90 dark:bg-amber-950/25" : ""} ${
                  !isHoliday && isWeekdayClosed && inMonth ? "bg-muted/50" : ""
                }`}
              >
                {onSelectDay ? (
                  <button
                    type="button"
                    onClick={() => onSelectDay(startOfDay(new Date(day.getTime())))}
                    className={`inline-flex size-6 items-center justify-center rounded text-xs transition-colors hover:bg-muted ${
                      inMonth ? "text-foreground" : "text-muted-foreground"
                    }`}
                    title="1日の予約を見る"
                  >
                    {day.getDate()}
                  </button>
                ) : (
                  <span
                    className={`inline-flex size-6 items-center justify-center rounded text-xs ${
                      inMonth ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                )}
                {isHoliday ? (
                  <span className="mt-0.5 block text-[0.65rem] leading-tight text-amber-800 dark:text-amber-200">
                    定休
                  </span>
                ) : isWeekdayClosed && inMonth ? (
                  <span className="mt-0.5 block text-[0.65rem] leading-tight text-muted-foreground">
                    休業
                  </span>
                ) : null}
                <div className="mt-0.5 space-y-0.5">
                  {dayReservations.map((r) => {
                    const bgColor = getReservationTrainerColor(r, staffList)
                    return (
                    <button
                      key={r.id}
                      type="button"
                      className="block w-full truncate rounded border px-1 py-0.5 text-left text-[10px] leading-tight transition-opacity hover:opacity-90"
                      style={{
                        backgroundColor: `${bgColor}20`,
                        borderColor: bgColor,
                      }}
                      onClick={() => onSelectReservation(r)}
                      title={`${formatTimeRange(r.startAt, r.endAt)} ${r.customerName}`}
                    >
                      <span className="text-muted-foreground">
                        {formatTimeRange(r.startAt, r.endAt)}
                      </span>{" "}
                      <span className="font-medium">{r.customerName}</span>
                    </button>
                  )})}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
