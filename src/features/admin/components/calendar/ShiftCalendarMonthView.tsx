import { useState } from "react"
import { useNavigate } from "react-router-dom"
import type { BusinessHoursItem } from "@/features/admin/api/adminSettingsApi"
import {
  applyTrainerDayShift,
  deleteTrainerShift,
} from "@/features/admin/api/trainerShiftsApi"
import { useAdminShiftAvailability } from "@/features/admin/context/AdminShiftAvailabilityContext"
import type { ResolvedShiftDay } from "@/features/admin/context/AdminShiftAvailabilityContext"
import {
  ShiftAvailabilityEditDialog,
  type ShiftEditCommit,
} from "@/features/admin/components/calendar/ShiftAvailabilityEditDialog"
import {
  ADMIN_CALENDAR_TIME_ZONE,
  startOfMonth,
  endOfMonth,
  addDays,
  startOfDay,
  startOfWeek,
  toDateKey,
  WEEKDAY_LABELS,
  getDateKeyInTimeZone,
} from "@/features/admin/lib/calendarUtils"
import { getBusinessHoursForJsDate } from "@/features/admin/lib/businessHours"
import type { Reservation } from "@/features/admin/types/reservation"
import type { Staff } from "@/features/admin/types/staff"
import { ROUTES } from "@/constants/routes"
import {
  getShiftCalendarTodayKey,
  isShiftRegisterableDateKey,
  isShiftRegisterableDay,
  isViewingShiftCalendarCurrentMonth,
} from "@/features/admin/lib/shiftDatePolicy"
import { isShiftEditableForStaff } from "@/features/admin/lib/shiftPermissions"
import { useAdminProfile } from "@/features/auth/context/AdminProfileContext"
import { cn } from "@/lib/utils"

interface ShiftCalendarMonthViewProps {
  date: Date
  staffList: Staff[]
  businessHoursItems: BusinessHoursItem[]
  /** `GET /api/admin/settings` の `holidays`（YYYY-MM-DD） */
  holidayDateKeys?: ReadonlySet<string>
  settingsLoading: boolean
  reservations: Reservation[]
  reservationsLoading: boolean
  reservationsFetchFailed: boolean
  refetchShifts: () => void
}

function workSlotsLabel(resolved: Extract<ResolvedShiftDay, { kind: "work" }>): string {
  const parts = [resolved.slot, ...(resolved.moreSlots ?? [])].map(
    (s) => `${s.start}-${s.end}`,
  )
  return parts.join(" / ")
}

function rowLabel(resolved: ResolvedShiftDay, staff: Staff): string {
  if (resolved.kind === "work") {
    return `${staff.name}：${workSlotsLabel(resolved)}`
  }
  if (resolved.kind === "off_explicit") {
    return `${staff.name}：休み`
  }
  return `${staff.name}：—`
}

export function ShiftCalendarMonthView({
  date,
  staffList,
  businessHoursItems,
  holidayDateKeys,
  settingsLoading,
  reservations,
  reservationsLoading,
  reservationsFetchFailed,
  refetchShifts,
}: ShiftCalendarMonthViewProps) {
  const navigate = useNavigate()
  const profile = useAdminProfile()
  const { resolveStaffDay, setOverride, apiShiftRows } = useAdminShiftAvailability()
  const [editing, setEditing] = useState<{ staff: Staff; day: Date } | null>(null)

  const canEditStaff = (staff: Staff) => isShiftEditableForStaff(profile, staff)
  const shiftCalendarReadOnly = profile.role === "staff"
  const todayKey = getShiftCalendarTodayKey()
  const viewingCurrentCalendarMonth = isViewingShiftCalendarCurrentMonth(date, todayKey)

  const monthStart = startOfMonth(date)
  const monthEnd = endOfMonth(date)
  const calendarStart = startOfWeek(monthStart)
  const weeks: Date[][] = []
  let current = calendarStart
  /** 対象月の末日をまたぐまでの週だけ（6週固定にしない。翌月の週が余分に出ないようにする） */
  while (current <= monthEnd) {
    const week: Date[] = []
    for (let i = 0; i < 7; i++) {
      week.push(current)
      current = addDays(current, 1)
    }
    weeks.push(week)
  }

  const isCurrentMonth = (d: Date) => d.getMonth() === date.getMonth()

  const sortedStaff = [...staffList].sort((a, b) =>
    a.name.localeCompare(b.name, "ja"),
  )

  const resolvedEditing =
    editing != null ? resolveStaffDay(editing.staff, editing.day) : null

  const businessDayForEdit =
    editing != null ? getBusinessHoursForJsDate(businessHoursItems, editing.day) : null

  const handleCommit = async (commit: ShiftEditCommit) => {
    if (!editing) return
    const { staff, day } = editing
    if (!isShiftRegisterableDay(day, todayKey)) {
      throw new Error("PAST_DATE")
    }
    const dateKey = getDateKeyInTimeZone(day, ADMIN_CALENDAR_TIME_ZONE)
    const trainerId = staff.id
    const rows = apiShiftRows[trainerId]?.[dateKey] ?? []
    const ids = rows.map((r) => r.shift_id)

    try {
      if (commit.type === "save") {
        await applyTrainerDayShift(
          trainerId,
          {
            date: dateKey,
            start_time: commit.slot.start,
            end_time: commit.slot.end,
          },
          rows,
        )
        setOverride(trainerId, dateKey, null)
      } else if (commit.type === "off") {
        for (const id of ids) {
          await deleteTrainerShift(trainerId, id)
        }
        setOverride(trainerId, dateKey, null)
      }
      refetchShifts()
    } catch (e) {
      if (e instanceof Error && e.message === "UNAUTHORIZED") {
        navigate(ROUTES.backofficeLogin, { replace: true })
      }
      throw e
    }
  }

  return (
    <>
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
              const inMonth = isCurrentMonth(day)
              const dayNorm = startOfDay(new Date(day.getTime()))
              const dateKey = getDateKeyInTimeZone(day, ADMIN_CALENDAR_TIME_ZONE)
              const isHoliday =
                holidayDateKeys != null && holidayDateKeys.has(dateKey)
              const biz =
                businessHoursItems.length > 0
                  ? getBusinessHoursForJsDate(businessHoursItems, day)
                  : null
              const isWeekdayClosed = biz?.isClosed === true
              const isPastDay = !isShiftRegisterableDateKey(dateKey, todayKey)
              const isToday = dateKey === todayKey
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "min-h-[120px] border-b border-r border-border p-1 last:border-r-0",
                    inMonth ? "bg-background" : "bg-muted/20",
                    isHoliday && "bg-amber-50/90 dark:bg-amber-950/25",
                    !isHoliday && isWeekdayClosed && inMonth && "bg-muted/50",
                    isPastDay && inMonth && "bg-muted/30",
                    isToday && "bg-primary/5 ring-2 ring-inset ring-primary/60",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex size-6 items-center justify-center rounded text-xs",
                      inMonth ? "text-foreground" : "text-muted-foreground",
                      isToday &&
                        "rounded-full bg-primary font-semibold text-primary-foreground",
                    )}
                  >
                    {day.getDate()}
                  </span>
                  {isHoliday ? (
                    <span className="mt-0.5 block text-[0.65rem] leading-tight text-amber-800 dark:text-amber-200">
                      定休
                    </span>
                  ) : isWeekdayClosed && inMonth ? (
                    <span className="mt-0.5 block text-[0.65rem] leading-tight text-muted-foreground">
                      休業
                    </span>
                  ) : null}
                  {!isHoliday ? (
                  <div className="mt-0.5 space-y-0.5">
                    {sortedStaff.map((staff) => {
                      const resolved = resolveStaffDay(staff, dayNorm)
                      const work = resolved.kind === "work"
                      const hasExistingShift =
                        (apiShiftRows[staff.id]?.[dateKey]?.length ?? 0) > 0
                      // 当月の過去日は未登録でも表示（編集不可）。他月の過去日は従来どおり非表示。
                      if (
                        isPastDay &&
                        !work &&
                        !hasExistingShift &&
                        !(viewingCurrentCalendarMonth && inMonth)
                      ) {
                        return null
                      }
                      /** 曜日休業は新規/更新不可。既存シフトがある場合のみ削除目的で編集を許可。 */
                      const disableByClosedDay =
                        inMonth && isWeekdayClosed && !hasExistingShift
                      /** staff は自分以外のシフトを編集できない（参照のみ） */
                      const isOtherStaffForViewer = !canEditStaff(staff)
                      const disableShiftEdit =
                        shiftCalendarReadOnly ||
                        isPastDay ||
                        disableByClosedDay ||
                        isOtherStaffForViewer
                      const titleText = shiftCalendarReadOnly
                        ? `${rowLabel(resolved, staff)}（参照のみ。シフトの変更はできません）`
                        : isPastDay
                        ? `${rowLabel(resolved, staff)}（過去日のため登録・変更できません）`
                        : isOtherStaffForViewer
                          ? `${rowLabel(resolved, staff)}（他のスタッフのシフトのため編集できません。参照のみ）`
                          : disableByClosedDay
                            ? "休業日のため新規登録はできません（既存シフトがある日のみ削除可）"
                            : `${rowLabel(resolved, staff)}（クリックで編集）`
                      return (
                        <button
                          key={staff.id}
                          type="button"
                          disabled={disableShiftEdit}
                          className={cn(
                            "block w-full truncate rounded border px-1 py-0.5 text-left text-[10px] leading-tight transition-opacity",
                            !shiftCalendarReadOnly && "hover:opacity-90",
                            !work && !isPastDay && "border-dashed opacity-90",
                            disableShiftEdit &&
                              !shiftCalendarReadOnly &&
                              "cursor-not-allowed opacity-50 hover:opacity-50",
                            shiftCalendarReadOnly && "cursor-default",
                          )}
                          style={
                            work
                              ? {
                                  backgroundColor: `${staff.color}20`,
                                  borderColor: staff.color,
                                }
                              : {
                                  borderColor: `${staff.color}80`,
                                  backgroundColor: `${staff.color}08`,
                                }
                          }
                          title={titleText}
                          onClick={() => {
                            if (disableShiftEdit) return
                            setEditing({ staff, day: dayNorm })
                          }}
                        >
                          <span className="font-medium">{staff.name}</span>
                          <span className="text-muted-foreground">
                            {resolved.kind === "work"
                              ? `：${workSlotsLabel(resolved)}`
                              : resolved.kind === "off_explicit"
                                ? "：休み"
                                : "：—"}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <ShiftAvailabilityEditDialog
        key={editing ? `${editing.staff.id}-${toDateKey(editing.day)}` : "shift-edit-closed"}
        open={editing != null}
        staff={editing?.staff ?? null}
        day={editing?.day ?? null}
        resolved={resolvedEditing}
        businessDay={businessDayForEdit}
        settingsLoading={settingsLoading}
        reservations={reservations}
        reservationsLoading={reservationsLoading}
        reservationsFetchFailed={reservationsFetchFailed}
        onClose={() => setEditing(null)}
        onCommit={handleCommit}
      />
    </>
  )
}
