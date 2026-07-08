import { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  fetchAdminSettings,
  type BusinessHoursItem,
} from "@/features/admin/api/adminSettingsApi"
import { fetchAdminReservations } from "@/features/admin/api/reservationsApi"
import { fetchAdminUsersList } from "@/features/admin/api/adminUsersApi"
import {
  resolveTrainerFilterStaff,
  staffTrainerNames,
} from "@/features/admin/api/staffApi"
import { useAdminReservations } from "@/features/admin/context/AdminReservationsContext"
import { colorFromTrainerName, useStaff } from "@/features/admin/hooks/useStaff"
import { useAdminProfile } from "@/features/auth/context/AdminProfileContext"
import type { Staff } from "@/features/admin/types/staff"
import { ROUTES } from "@/constants/routes"
import { CalendarDayView } from "@/features/admin/components/calendar/CalendarDayView"
import { CalendarWeekView } from "@/features/admin/components/calendar/CalendarWeekView"
import { CalendarMonthView } from "@/features/admin/components/calendar/CalendarMonthView"
import {
  addDays,
  addWeeks,
  addMonths,
  startOfDay,
  formatDateJa,
} from "@/features/admin/lib/calendarUtils"

type ViewMode = "day" | "week" | "month"

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function parseViewParam(v: string | null): ViewMode {
  if (v === "day" || v === "week" || v === "month") return v
  return "month"
}

function parseDateParam(s: string | null): Date {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return startOfDay(new Date())
  const [y, m, d] = s.split("-").map(Number)
  const dt = new Date(y, m - 1, d)
  if (Number.isNaN(dt.getTime())) return startOfDay(new Date())
  return startOfDay(dt)
}

/** 予約カレンダーのトレーナー絞り込みチップ：スタッフ登録の表示色を優先 */
function trainerFilterDotColor(name: string, staffList: Staff[]): string {
  const staff = staffList.find((s) => s.name.trim() === name.trim())
  return staff?.color ?? colorFromTrainerName(name)
}

export function AdminCalendarPage() {
  const { reservations, loading, replaceReservations } = useAdminReservations()
  const { staffList, loading: staffLoading } = useStaff()
  const profile = useAdminProfile()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [adminUsers, setAdminUsers] = useState<
    Awaited<ReturnType<typeof fetchAdminUsersList>>
  >([])
  const [adminUsersLoading, setAdminUsersLoading] = useState(true)
  const [selectedTrainerNames, setSelectedTrainerNames] = useState<Set<string>>(
    () => new Set(),
  )
  const [calendarListLoading, setCalendarListLoading] = useState(true)
  const [calendarListError, setCalendarListError] = useState(false)
  const [calendarLastUpdated, setCalendarLastUpdated] = useState<Date | null>(null)
  const [businessHoursItems, setBusinessHoursItems] = useState<BusinessHoursItem[]>([])
  const [holidayDateKeys, setHolidayDateKeys] = useState<ReadonlySet<string>>(() => new Set())

  const viewMode = useMemo(
    () => parseViewParam(searchParams.get("view")),
    [searchParams],
  )
  const currentDate = useMemo(
    () => parseDateParam(searchParams.get("date")),
    [searchParams],
  )

  const staffListForFilter = useMemo(
    () => resolveTrainerFilterStaff(staffList, adminUsers, profile),
    [staffList, adminUsers, profile],
  )

  const trainerNameList = useMemo(
    () => staffTrainerNames(staffListForFilter),
    [staffListForFilter],
  )

  const reservationFetchOptions = useMemo(
    () => ({
      viewMode,
      anchorDate: currentDate,
    }),
    [viewMode, currentDate],
  )

  const refetchCalendarReservations = async () => {
    setCalendarListLoading(true)
    setCalendarListError(false)
    try {
      const list = await fetchAdminReservations(staffList, reservationFetchOptions)
      replaceReservations(list)
      setCalendarLastUpdated(new Date())
    } catch (e) {
      if (e instanceof Error && e.message === "UNAUTHORIZED") {
        navigate(ROUTES.backofficeLogin, { replace: true })
        return
      }
      setCalendarListError(true)
    } finally {
      setCalendarListLoading(false)
    }
  }

  useEffect(() => {
    if (staffLoading) return
    let cancelled = false
    void (async () => {
      try {
        const list = await fetchAdminReservations(staffList, reservationFetchOptions)
        if (cancelled) return
        replaceReservations(list)
        setCalendarLastUpdated(new Date())
      } catch (e) {
        if (cancelled) return
        if (e instanceof Error && e.message === "UNAUTHORIZED") {
          navigate(ROUTES.backofficeLogin, { replace: true })
          return
        }
        setCalendarListError(true)
      } finally {
        if (!cancelled) setCalendarListLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    staffLoading,
    staffList,
    replaceReservations,
    navigate,
    reservationFetchOptions,
  ])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setAdminUsersLoading(true)
      try {
        const users = await fetchAdminUsersList()
        if (!cancelled) setAdminUsers(users)
      } catch (e) {
        if (cancelled) return
        if (e instanceof Error && e.message === "UNAUTHORIZED") {
          navigate(ROUTES.backofficeLogin, { replace: true })
          return
        }
        setAdminUsers([])
      } finally {
        if (!cancelled) setAdminUsersLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [navigate])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const s = await fetchAdminSettings()
        if (cancelled) return
        setBusinessHoursItems(s.business_hours)
        setHolidayDateKeys(new Set(s.holidays))
      } catch (e) {
        if (cancelled) return
        if (e instanceof Error && e.message === "UNAUTHORIZED") {
          navigate(ROUTES.backofficeLogin, { replace: true })
          return
        }
        setBusinessHoursItems([])
        setHolidayDateKeys(new Set())
      }
    })()
    return () => {
      cancelled = true
    }
  }, [navigate])

  useEffect(() => {
    const valid = new Set(trainerNameList)
    setSelectedTrainerNames((prev) => {
      const next = new Set<string>()
      prev.forEach((n) => {
        if (valid.has(n)) next.add(n)
      })
      if (next.size === prev.size && [...prev].every((n) => next.has(n))) {
        return prev
      }
      return next
    })
  }, [trainerNameList])

  const patchSearchParams = (patch: (p: URLSearchParams) => void) => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        patch(p)
        const v = p.get("view")
        if (v === "month") p.delete("view")
        return p
      },
      { replace: true },
    )
  }

  const handleSelectReservation = (id: string) => {
    navigate(ROUTES.adminReservationDetail.replace(":id", id))
  }

  const setViewMode = (mode: ViewMode) => {
    patchSearchParams((p) => {
      if (mode === "month") {
        p.delete("view")
      } else {
        p.set("view", mode)
      }
      if (!p.get("date")) {
        p.set("date", ymd(startOfDay(new Date())))
      }
    })
  }

  const goPrev = () => {
    patchSearchParams((p) => {
      const vm = parseViewParam(p.get("view"))
      const d = parseDateParam(p.get("date"))
      const next =
        vm === "day"
          ? addDays(d, -1)
          : vm === "week"
            ? addWeeks(d, -1)
            : addMonths(d, -1)
      p.set("date", ymd(next))
    })
  }

  const goNext = () => {
    patchSearchParams((p) => {
      const vm = parseViewParam(p.get("view"))
      const d = parseDateParam(p.get("date"))
      const next =
        vm === "day"
          ? addDays(d, 1)
          : vm === "week"
            ? addWeeks(d, 1)
            : addMonths(d, 1)
      p.set("date", ymd(next))
    })
  }

  const goToday = () => {
    patchSearchParams((p) => {
      p.set("date", ymd(startOfDay(new Date())))
    })
  }

  const weekStart =
    viewMode === "week"
      ? (() => {
          const d = new Date(currentDate)
          const day = d.getDay()
          const diff = day === 0 ? -6 : 1 - day
          d.setDate(d.getDate() + diff)
          return d
        })()
      : null
  const weekEnd = weekStart ? addDays(weekStart, 6) : null

  const titleByMode =
    viewMode === "day"
      ? formatDateJa(currentDate)
      : viewMode === "week" && weekStart && weekEnd
        ? `${weekStart.getMonth() + 1}/${weekStart.getDate()} ～ ${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`
        : `${currentDate.getFullYear()}年 ${currentDate.getMonth() + 1}月`

  const filteredReservations = useMemo(() => {
    if (selectedTrainerNames.size === 0) return reservations
    return reservations.filter((r) => {
      const t = r.trainerName?.trim()
      if (t && selectedTrainerNames.has(t)) return true
      const staff = staffListForFilter.find((s) => s.id === r.assigneeId)
      const byStaffName = staff?.name.trim()
      if (byStaffName && selectedTrainerNames.has(byStaffName)) return true
      return false
    })
  }, [reservations, selectedTrainerNames, staffListForFilter])

  const toggleTrainerName = (name: string) => {
    setSelectedTrainerNames((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const clearTrainerFilter = () => setSelectedTrainerNames(new Set())

  if (
    loading ||
    staffLoading ||
    adminUsersLoading ||
    calendarListLoading
  ) {
    return (
      <p className="text-sm text-muted-foreground">読み込み中...</p>
    )
  }

  if (calendarListError) {
    return (
      <div className="space-y-3 rounded-lg border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          予約一覧の取得に失敗しました。ネットワークまたはサーバーを確認してください。
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void refetchCalendarReservations()}
        >
          再試行
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-lg border-border shadow-xs">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">トレーナーで絞り込み</CardTitle>
          <p className="text-sm text-muted-foreground">
            店舗に登録されているスタッフ（trainers）の名前から選びます。管理者（admin）アカウントは含みません。複数選べます。未選択のときは店舗の予約をすべて表示します。
          </p>
        </CardHeader>
        <CardContent>
          {staffLoading ? (
            <p className="text-sm text-muted-foreground">スタッフ一覧を読み込み中...</p>
          ) : (
            <div className="self-end flex flex-wrap items-center gap-2">
              {trainerNameList.map((name) => (
                <Button
                  key={name}
                  variant={selectedTrainerNames.has(name) ? "default" : "outline"}
                  size="sm"
                  className="rounded-full px-4"
                  onClick={() => toggleTrainerName(name)}
                  aria-pressed={selectedTrainerNames.has(name)}
                >
                  <span
                    className="mr-2 inline-block size-3 shrink-0 rounded-full"
                    style={{
                      backgroundColor: trainerFilterDotColor(name, staffListForFilter),
                    }}
                  />
                  {name}
                </Button>
              ))}
              {trainerNameList.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={clearTrainerFilter}
                  disabled={selectedTrainerNames.size === 0}
                >
                  選択をクリア
                </Button>
              )}
              {trainerNameList.length === 0 ? (
                <p className="text-sm text-muted-foreground">登録されているトレーナーがありません。</p>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-lg border-border shadow-xs">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg">予約カレンダー</CardTitle>
          <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:flex-nowrap">
            <div className="mt-1 flex flex-wrap items-center gap-2 sm:mr-6 sm:mt-2">
            <div className="flex rounded-md border border-border bg-muted/30 p-0.5">
              {(["day", "week", "month"] as const).map((mode) => (
                <Button
                  key={mode}
                  variant={viewMode === mode ? "secondary" : "ghost"}
                  size="sm"
                  className="rounded px-3 text-xs"
                  onClick={() => setViewMode(mode)}
                >
                  {mode === "day" ? "1日" : mode === "week" ? "1週間" : "1ヶ月"}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="size-8" onClick={goPrev} aria-label="前へ">
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="ghost" size="sm" className="min-w-[120px]" onClick={goToday}>
                {titleByMode}
              </Button>
              <Button variant="outline" size="icon" className="size-8" onClick={goNext} aria-label="次へ">
                <ChevronRight className="size-4" />
              </Button>
            </div>
            </div>
            <div className="ml-auto flex flex-col items-end gap-1">
              {calendarLastUpdated ? (
                <p className="text-xs text-muted-foreground text-right">
                  最終更新: {calendarLastUpdated.toLocaleString("ja-JP")}
                </p>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                className="rounded-md"
                disabled={calendarListLoading}
                onClick={() => void refetchCalendarReservations()}
              >
                <RefreshCw className="mr-1 size-4" />
                再読み込み
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === "day" && (
            <CalendarDayView
              date={currentDate}
              reservations={filteredReservations}
              staffList={staffListForFilter}
              onSelectReservation={(r) => handleSelectReservation(r.id)}
              holidayDateKeys={holidayDateKeys}
              businessHoursItems={businessHoursItems}
            />
          )}
          {viewMode === "week" && (
            <CalendarWeekView
              date={currentDate}
              reservations={filteredReservations}
              staffList={staffListForFilter}
              onSelectReservation={(r) => handleSelectReservation(r.id)}
              holidayDateKeys={holidayDateKeys}
              businessHoursItems={businessHoursItems}
            />
          )}
          {viewMode === "month" && (
            <CalendarMonthView
              date={currentDate}
              reservations={filteredReservations}
              staffList={staffListForFilter}
              onSelectReservation={(r) => handleSelectReservation(r.id)}
              onSelectDay={(day) => {
                patchSearchParams((p) => {
                  p.set("view", "day")
                  p.set("date", ymd(startOfDay(day)))
                })
              }}
              holidayDateKeys={holidayDateKeys}
              businessHoursItems={businessHoursItems}
            />
          )}
        </CardContent>
      </Card>

    </div>
  )
}
