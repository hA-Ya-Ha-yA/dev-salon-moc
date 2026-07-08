import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ShiftBulkMonthPanel } from "@/features/admin/components/calendar/ShiftBulkMonthPanel"
import { filterEditableStaff } from "@/features/admin/lib/shiftPermissions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { fetchAdminUsersList } from "@/features/admin/api/adminUsersApi"
import {
  fetchAdminBusinessHours,
  fetchAdminHolidays,
  type BusinessHoursItem,
} from "@/features/admin/api/adminSettingsApi"
import { fetchAdminReservations } from "@/features/admin/api/reservationsApi"
import { resolveDisplayStaffTrainers } from "@/features/admin/api/staffApi"
import { useAdminReservations } from "@/features/admin/context/AdminReservationsContext"
import { useTrainerShiftsForMonth } from "@/features/admin/hooks/useTrainerShiftsForMonth"
import { useStaff } from "@/features/admin/hooks/useStaff"
import { ShiftCalendarMonthView } from "@/features/admin/components/calendar/ShiftCalendarMonthView"
import { useAdminProfile } from "@/features/auth/context/AdminProfileContext"
import { addMonths, startOfDay } from "@/features/admin/lib/calendarUtils"
import { ROUTES } from "@/constants/routes"

type ShiftRegisterView = "individual" | "bulk"

export function AdminShiftCalendarPage() {
  const navigate = useNavigate()
  const profile = useAdminProfile()
  const { staffList, loading: staffLoading } = useStaff()
  const { reservations, replaceReservations } = useAdminReservations()
  const [reservationsLoading, setReservationsLoading] = useState(true)
  const [reservationsFetchFailed, setReservationsFetchFailed] = useState(false)
  const [currentDate, setCurrentDate] = useState(() => startOfDay(new Date()))
  const [businessHoursItems, setBusinessHoursItems] = useState<BusinessHoursItem[]>([])
  const [holidayDateKeys, setHolidayDateKeys] = useState<ReadonlySet<string>>(() => new Set())
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [settingsError, setSettingsError] = useState(false)
  const [adminUsers, setAdminUsers] = useState<
    Awaited<ReturnType<typeof fetchAdminUsersList>>
  >([])
  const [adminUsersLoading, setAdminUsersLoading] = useState(true)
  const [registerView, setRegisterView] = useState<ShiftRegisterView>("individual")

  const isOwner = profile.role === "owner"

  /** カレンダー表示用: 店舗のスタッフ全員（管理者行のみ除外） */
  const staffListForShifts = useMemo(() => {
    const filtered = resolveDisplayStaffTrainers(staffList, adminUsers, profile)
    return filtered.length > 0 ? filtered : staffList
  }, [staffList, adminUsers, profile])

  const editableStaffForShifts = useMemo(
    () => filterEditableStaff(staffListForShifts, profile),
    [staffListForShifts, profile],
  )

  const canUseBulkRegister = isOwner && editableStaffForShifts.length > 0 && !settingsError

  const { loading: shiftsLoading, error: shiftsError, refetch } = useTrainerShiftsForMonth(
    staffListForShifts,
    currentDate,
  )

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
      setSettingsLoading(true)
      setSettingsError(false)
      try {
        const [business_hours, holidays] = await Promise.all([
          fetchAdminBusinessHours(),
          fetchAdminHolidays(),
        ])
        if (!cancelled) {
          setBusinessHoursItems(business_hours)
          setHolidayDateKeys(new Set(holidays))
        }
      } catch (e) {
        if (cancelled) return
        if (e instanceof Error && e.message === "UNAUTHORIZED") {
          navigate(ROUTES.backofficeLogin, { replace: true })
          return
        }
        setSettingsError(true)
      } finally {
        if (!cancelled) setSettingsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [navigate])

  useEffect(() => {
    if (staffLoading || adminUsersLoading) return
    let cancelled = false
    void (async () => {
      setReservationsLoading(true)
      setReservationsFetchFailed(false)
      try {
        const list = await fetchAdminReservations(staffListForShifts, {
          viewMode: "month",
          anchorDate: currentDate,
        })
        if (cancelled) return
        replaceReservations(list)
      } catch (e) {
        if (cancelled) return
        if (e instanceof Error && e.message === "UNAUTHORIZED") {
          navigate(ROUTES.backofficeLogin, { replace: true })
          return
        }
        setReservationsFetchFailed(true)
      } finally {
        if (!cancelled) setReservationsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    staffLoading,
    adminUsersLoading,
    staffListForShifts,
    replaceReservations,
    navigate,
    currentDate,
  ])

  const goPrev = () => {
    setCurrentDate((d) => addMonths(d, -1))
  }

  const goNext = () => {
    setCurrentDate((d) => addMonths(d, 1))
  }

  const goToday = () => {
    setCurrentDate(startOfDay(new Date()))
  }

  const titleMonth = `${currentDate.getFullYear()}年 ${currentDate.getMonth() + 1}月`

  if (
    staffLoading ||
    adminUsersLoading ||
    (staffListForShifts.length > 0 && shiftsLoading)
  ) {
    return <p className="text-sm text-muted-foreground">読み込み中...</p>
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-lg border-border shadow-xs">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg">
              {registerView === "individual" ? "シフトカレンダー" : "シフト一括登録"}
            </CardTitle>
            {registerView === "individual" ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {isOwner
                  ? "カレンダーから日ごとにシフトを登録・編集します（当日以降のみ）。"
                  : "店舗に所属するスタッフ全員のシフトを確認できます（表示のみ。変更はできません）。"}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {registerView === "individual" ? (
              canUseBulkRegister ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setRegisterView("bulk")}
                >
                  シフト一括登録
                </Button>
              ) : null
            ) : (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setRegisterView("individual")}
              >
                シフトカレンダー
              </Button>
            )}
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                onClick={goPrev}
                aria-label="前の月へ"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="min-w-[120px]"
                onClick={goToday}
              >
                {titleMonth}
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                onClick={goNext}
                aria-label="次の月へ"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {settingsError ? (
            <p className="mb-4 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              営業時間または定休日の取得に失敗しました。シフトの保存時は営業時間内に収まる必要があります。
            </p>
          ) : null}
          {shiftsError ? (
            <p className="py-8 text-center text-sm text-destructive">
              シフト一覧の取得に失敗しました。ネットワークまたはサーバーを確認してください。
            </p>
          ) : staffListForShifts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              表示できるスタッフがいません。スタッフ管理で担当者を登録し、有効（is_active）になっているか確認してください。
            </p>
          ) : registerView === "bulk" ? (
            <ShiftBulkMonthPanel
              monthAnchor={currentDate}
              monthLabel={titleMonth}
              editableStaff={editableStaffForShifts}
              businessHoursItems={businessHoursItems}
              holidayDateKeys={holidayDateKeys}
              settingsLoading={settingsLoading}
              settingsError={settingsError}
              reservations={reservations}
              reservationsLoading={reservationsLoading}
              reservationsFetchFailed={reservationsFetchFailed}
              onApplied={() => refetch()}
            />
          ) : (
            <ShiftCalendarMonthView
              date={currentDate}
              staffList={staffListForShifts}
              businessHoursItems={businessHoursItems}
              holidayDateKeys={holidayDateKeys}
              settingsLoading={settingsLoading}
              reservations={reservations}
              reservationsLoading={reservationsLoading}
              reservationsFetchFailed={reservationsFetchFailed}
              refetchShifts={refetch}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
