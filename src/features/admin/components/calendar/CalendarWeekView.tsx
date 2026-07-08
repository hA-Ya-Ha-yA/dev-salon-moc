import type { BusinessHoursItem } from "@/features/admin/api/adminSettingsApi"
import { getBusinessHoursForJsDate } from "@/features/admin/lib/businessHours"
import {
  ADMIN_CALENDAR_TIME_ZONE,
  addDays,
  getDateKeyInTimeZone,
  getIsoDateKeyInTimeZone,
  getReservationsInRange,
  startOfWeek,
  endOfDay,
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

interface CalendarWeekViewProps {
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

/** 週タイムラインのブロック高さ・幅に応じた表示段階（メニューは最優先で省略） */
type WeekBlockDisplayMode =
  | "threeLines"
  | "twoLinesNoMenu"
  | "oneLine"
  | "oneLineSmallTime"

function getWeekReservationBlockDisplayMode(
  durationMinutes: number,
  heightPercent: number,
  widthPercent: number,
): WeekBlockDisplayMode {
  const compact = isCompactReservationTimelineBlock(durationMinutes, heightPercent)

  if (compact) {
    if (heightPercent < 3.2 || widthPercent < 28) {
      return "oneLineSmallTime"
    }
    return "oneLine"
  }

  const canShowMenu =
    widthPercent >= 22 &&
    heightPercent >= 4.5 &&
    durationMinutes >= 45

  if (!canShowMenu) {
    return "twoLinesNoMenu"
  }

  return "threeLines"
}

export function CalendarWeekView({
  date,
  reservations,
  staffList,
  onSelectReservation,
  holidayDateKeys,
  businessHoursItems,
}: CalendarWeekViewProps) {
  const weekStart = startOfWeek(date)
  const weekEnd = endOfDay(addDays(weekStart, 6))
  const weekReservations = getReservationsInRange(
    reservations,
    weekStart,
    weekEnd,
  )
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        <div className="grid grid-cols-[56px_repeat(7,1fr)] gap-px border border-border bg-border">
          {/* 左端：曜日ヘッダー用の空セル（時間列は下の行で表示） */}
          <div className="bg-muted/50" />

          {/* 曜日ヘッダー */}
          {days.map((d) => {
            const dayOfWeek = d.getDay()
            const isSun = dayOfWeek === 0
            const isSat = dayOfWeek === 6
            const dateKey = getDateKeyInTimeZone(d, ADMIN_CALENDAR_TIME_ZONE)
            const isHoliday = holidayDateKeys != null && holidayDateKeys.has(dateKey)
            const biz =
              businessHoursItems != null && businessHoursItems.length > 0
                ? getBusinessHoursForJsDate(businessHoursItems, d)
                : null
            const isWeekdayClosed = biz?.isClosed === true
            return (
              <div
                key={d.toISOString()}
                className={`py-1 text-center text-xs font-medium ${
                  isSun
                    ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400"
                    : isSat
                      ? "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400"
                      : "bg-muted/30 text-muted-foreground"
                }`}
              >
                <span className="block">
                  {d.getMonth() + 1}/{d.getDate()}{" "}
                  ({["日", "月", "火", "水", "木", "金", "土"][dayOfWeek]})
                </span>
                {isHoliday ? (
                  <span className="block text-[0.65rem] font-normal text-amber-900 dark:text-amber-100">
                    定休
                  </span>
                ) : isWeekdayClosed ? (
                  <span className="block text-[0.65rem] font-normal opacity-90">休業</span>
                ) : null}
              </div>
            )
          })}

          {/* 左端：時間ラベル＋実線・点線（スケジュールと同じ高さで時刻を配置） */}
          <div
            className="relative bg-muted/20"
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
            {/* 15分刻みの点線 */}
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
            {/* 時刻ラベル（実線の位置に合わせて配置） */}
            {HOURS.map((hour, index) => (
              <div
                key={`label-${hour}`}
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

          {/* 各日の列 */}
          {days.map((day) => {
            const dayKey = getDateKeyInTimeZone(day, ADMIN_CALENDAR_TIME_ZONE)
            const dayReservations = weekReservations.filter(
              (r) =>
                getIsoDateKeyInTimeZone(r.startAt, ADMIN_CALENDAR_TIME_ZONE) ===
                dayKey,
            )

            return (
              <div
                key={day.toISOString()}
                className="relative bg-background"
                style={{ height: `${(END_HOUR - START_HOUR) * 56}px` }}
              >
                {/* 実線・点線（背景） */}
                {HOURS.map((_, index) => (
                  <div
                    key={`solid-${index}`}
                    className="pointer-events-none absolute inset-x-0 border-t border-border/40"
                    style={{ top: `${(index / (HOURS.length - 1)) * 100}%` }}
                  />
                ))}
                {HOURS.slice(0, -1).map((_, hourIndex) =>
                  [0.25, 0.5, 0.75].map((fraction) => (
                    <div
                      key={`dotted-${hourIndex}-${fraction}`}
                      className="pointer-events-none absolute inset-x-0 border-t border-dotted border-border/30"
                      style={{
                        top: `${((hourIndex + fraction) / (HOURS.length - 1)) * 100}%`,
                      }}
                    />
                  )),
                )}

                {/* 予約ブロック（重なる時間帯は列を分割） */}
                {(() => {
                  const withPos = dayReservations
                    .map((r) => {
                      const startMinutes = toMinutesFromDayStart(
                        new Date(r.startAt),
                      )
                      const endMinutes = toMinutesFromDayStart(
                        new Date(r.endAt),
                      )
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
                    withPos.map((w) => w.interval),
                  )
                  const layoutById = new Map(layout.map((l) => [l.id, l]))

                  return withPos.map(
                    ({ r, topPercent, heightPercent, durationMinutes }) => {
                      const l = layoutById.get(r.id)!
                      const leftPercent = (l.column / l.columnCount) * 100
                      const widthPercent = 100 / l.columnCount
                      const bgColor = getReservationTrainerColor(r, staffList)
                      const displayMode = getWeekReservationBlockDisplayMode(
                        durationMinutes,
                        heightPercent,
                        widthPercent,
                      )
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
                            {displayMode === "threeLines" ? (
                              <div className="flex flex-col gap-0.5 break-words [overflow-wrap:anywhere]">
                                <span className="text-xs font-semibold text-foreground">{r.customerName}</span>
                                <span className="tabular-nums text-[10px] text-muted-foreground">{range}</span>
                                {menu ? (
                                  <span className="text-[10px] leading-tight text-muted-foreground">{menu}</span>
                                ) : null}
                              </div>
                            ) : null}
                            {displayMode === "twoLinesNoMenu" ? (
                              <div className="flex flex-col gap-0.5 break-words [overflow-wrap:anywhere]">
                                <span className="text-xs font-semibold text-foreground">{r.customerName}</span>
                                <span className="tabular-nums text-[10px] text-muted-foreground">{range}</span>
                              </div>
                            ) : null}
                            {displayMode === "oneLine" ? (
                              <span className="block break-words leading-tight [overflow-wrap:anywhere]">
                                <span className="font-semibold text-foreground">{r.customerName}</span>
                                <span className="tabular-nums text-muted-foreground"> {range}</span>
                              </span>
                            ) : null}
                            {displayMode === "oneLineSmallTime" ? (
                              <span className="block break-words leading-tight [overflow-wrap:anywhere]">
                                <span className="font-semibold text-foreground">{r.customerName}</span>
                                <span className="tabular-nums text-[9px] leading-none text-muted-foreground">
                                  {" "}
                                  {range}
                                </span>
                              </span>
                            ) : null}
                          </div>
                        </button>
                      )
                    })
                })()}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
