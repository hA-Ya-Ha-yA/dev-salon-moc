import type { BusinessHoursItem } from "@/features/admin/api/adminSettingsApi"
import { getBusinessHoursForJsDate } from "@/features/admin/lib/businessHours"
import {
  ADMIN_CALENDAR_TIME_ZONE,
  getDateKeyInTimeZone,
  getReservationsForDay,
  formatTimeRange,
  isCompactReservationTimelineBlock,
} from "@/features/admin/lib/calendarUtils"
import type { Reservation } from "@/features/admin/types/reservation"
import type { Staff } from "@/features/admin/types/staff"
import { layoutOverlappingIntervals } from "@/features/admin/lib/calendarOverlapLayout"
import { getReservationTrainerColor } from "@/features/admin/hooks/useStaff"

// 8:00〜22:00 を表示対象（14時間）
const START_HOUR = 8
const END_HOUR = 22
const HOURS = Array.from(
  { length: END_HOUR - START_HOUR + 1 },
  (_, i) => START_HOUR + i,
)
const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60

interface CalendarDayViewProps {
  date: Date
  reservations: Reservation[]
  staffList: Staff[]
  onSelectReservation: (r: Reservation) => void
  holidayDateKeys?: ReadonlySet<string>
  businessHoursItems?: BusinessHoursItem[]
}

function toMinutesFromDayStart(date: Date): number {
  return date.getHours() * 60 + date.getMinutes() - START_HOUR * 60
}

export function CalendarDayView({
  date,
  reservations,
  staffList,
  onSelectReservation,
  holidayDateKeys,
  businessHoursItems,
}: CalendarDayViewProps) {
  const dayReservations = getReservationsForDay(reservations, date)
  const dateKey = getDateKeyInTimeZone(date, ADMIN_CALENDAR_TIME_ZONE)
  const isHoliday = holidayDateKeys != null && holidayDateKeys.has(dateKey)
  const biz =
    businessHoursItems != null && businessHoursItems.length > 0
      ? getBusinessHoursForJsDate(businessHoursItems, date)
      : null
  const isWeekdayClosed = biz?.isClosed === true

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[320px]">
        {isHoliday || isWeekdayClosed ? (
          <p
            className="mb-2 rounded-md border border-border bg-muted/30 px-2 py-1.5 text-xs text-muted-foreground"
            role="status"
          >
            {isHoliday ? (
              <span className="text-amber-900 dark:text-amber-100">
                この日は定休日（holidays）です。
              </span>
            ) : (
              "この曜日は営業時間（business_hours）で休業です。"
            )}
          </p>
        ) : null}
        <div className="grid grid-cols-[56px_1fr] gap-2">
          {/* 時間ラベル列 */}
          <div className="relative">
            {HOURS.slice(0, -1).map((hour, index) => (
              <div
                key={hour}
                className="absolute right-1 text-right text-xs text-muted-foreground"
                style={{
                  top: `${(index / (HOURS.length - 1)) * 100}%`,
                  transform: "translateY(-50%)",
                }}
              >
                {hour.toString().padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {/* タイムライン＋予約ブロック */}
          <div
            className="relative border-t border-border/60"
            style={{ height: `${(END_HOUR - START_HOUR) * 56}px` }}
          >
            {/* 1時間ごとの実線 */}
            {HOURS.map((_, index) => (
              <div
                key={`solid-${index}`}
                className="pointer-events-none absolute inset-x-0 border-t border-border/60"
                style={{ top: `${(index / (HOURS.length - 1)) * 100}%` }}
              />
            ))}

            {/* 15分刻みの点線（0.25, 0.5, 0.75） */}
            {HOURS.slice(0, -1).map((_, hourIndex) =>
              [0.25, 0.5, 0.75].map((fraction) => (
                <div
                  key={`dotted-${hourIndex}-${fraction}`}
                  className="pointer-events-none absolute inset-x-0 border-t border-dotted border-border/40"
                  style={{
                    top: `${((hourIndex + fraction) / (HOURS.length - 1)) * 100}%`,
                  }}
                />
              )),
            )}

            {/* 時間が重なる予約は列を割り当てて横並び（重ならないように配置） */}
            {(() => {
              const withPosition = dayReservations
                .map((r) => {
                  const startMinutes = toMinutesFromDayStart(new Date(r.startAt))
                  const endMinutes = toMinutesFromDayStart(new Date(r.endAt))
                  const clampedStart = Math.max(0, startMinutes)
                  const clampedEnd = Math.min(TOTAL_MINUTES, endMinutes)
                  if (clampedEnd <= clampedStart) return null
                  const durationMinutes = clampedEnd - clampedStart
                  return {
                    r,
                    durationMinutes,
                    topPercent: (clampedStart / TOTAL_MINUTES) * 100,
                    heightPercent:
                      ((clampedEnd - clampedStart) / TOTAL_MINUTES) * 100,
                    interval: {
                      id: r.id,
                      start: clampedStart,
                      end: clampedEnd,
                    },
                  }
                })
                .filter((x): x is NonNullable<typeof x> => x != null)

              const layout = layoutOverlappingIntervals(
                withPosition.map((w) => w.interval),
              )
              const layoutById = new Map(layout.map((l) => [l.id, l]))

              return withPosition.map(
                ({ r, topPercent, heightPercent, durationMinutes }) => {
                const l = layoutById.get(r.id)!
                const leftPercent = (l.column / l.columnCount) * 100
                const widthPercent = 100 / l.columnCount
                const bgColor = getReservationTrainerColor(r, staffList)
                const compact = isCompactReservationTimelineBlock(durationMinutes, heightPercent)
                const range = formatTimeRange(r.startAt, r.endAt)
                const menu = r.menuName?.trim()
                const title = [r.customerName, range, menu, r.memo?.trim()]
                  .filter(Boolean)
                  .join(" · ")
                return (
                  <button
                    key={r.id}
                    type="button"
                    title={title}
                    className="absolute flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border text-left text-[10px] shadow-sm transition-opacity hover:opacity-90"
                    style={{
                      top: `${topPercent}%`,
                      left: `${leftPercent}%`,
                      width: `calc(${widthPercent}% - 2px)`,
                      height: `${heightPercent}%`,
                      boxSizing: "border-box",
                      marginRight: "1px",
                      backgroundColor: `${bgColor}20`,
                      borderColor: bgColor,
                    }}
                    onClick={() => onSelectReservation(r)}
                  >
                    <div
                      className="min-h-0 w-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-1 py-0.5 [scrollbar-width:thin]"
                    >
                      {compact ? (
                        <span className="block break-words leading-tight [overflow-wrap:anywhere]">
                          <span className="font-semibold text-foreground">{r.customerName}</span>
                          <span className="tabular-nums text-muted-foreground"> {range}</span>
                          {menu ? <span className="text-muted-foreground"> {menu}</span> : null}
                        </span>
                      ) : (
                        <div className="flex flex-col gap-0.5 break-words [overflow-wrap:anywhere]">
                          <span className="text-xs font-semibold text-foreground">{r.customerName}</span>
                          <span className="tabular-nums text-[10px] text-muted-foreground">{range}</span>
                          {menu ? (
                            <span className="text-[10px] leading-tight text-muted-foreground">{menu}</span>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </button>
                )
              })
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}
