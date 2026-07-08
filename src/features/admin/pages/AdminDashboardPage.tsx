import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

import { ROUTES } from "@/constants/routes"
import { fetchAdminReservations } from "@/features/admin/api/reservationsApi"
import { AdminOwnerFeatureHub } from "@/features/admin/components/AdminOwnerFeatureHub"
import { AdminSalonSlugCard } from "@/features/admin/components/AdminSalonSlugCard"
import { AdminStaffFeatureHub } from "@/features/admin/components/AdminStaffFeatureHub"
import { TodayReservationsCard } from "@/features/admin/components/TodayReservationsCard"
import { useStaff } from "@/features/admin/hooks/useStaff"
import {
  ADMIN_CALENDAR_TIME_ZONE,
  getDateKeyInTimeZone,
  getIsoDateKeyInTimeZone,
} from "@/features/admin/lib/calendarUtils"
import type { Reservation } from "@/features/admin/types/reservation"
import { useAdminProfile } from "@/features/auth/context/AdminProfileContext"

export function AdminDashboardPage() {
  const navigate = useNavigate()
  const profile = useAdminProfile()
  const { staffList, loading: staffLoading } = useStaff()
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [todayReservations, setTodayReservations] = useState<Reservation[]>([])
  const [todayFetchLoading, setTodayFetchLoading] = useState(true)
  const [todayRefreshing, setTodayRefreshing] = useState(false)

  const fetchTodayReservations = useCallback(async () => {
    const jstKey = getDateKeyInTimeZone(new Date(), ADMIN_CALENDAR_TIME_ZONE)
    const list = await fetchAdminReservations(staffList, {
      viewMode: "day",
      anchorDate: new Date(),
      dateKeyOverride: jstKey,
    })
    const onlyToday = list.filter(
      (reservation) =>
        getIsoDateKeyInTimeZone(reservation.startAt, ADMIN_CALENDAR_TIME_ZONE) === jstKey,
    )
    setTodayReservations(onlyToday)
    setLastUpdated(new Date())
  }, [staffList])

  useEffect(() => {
    if (staffLoading) return
    let cancelled = false
    void (async () => {
      setTodayFetchLoading(true)
      try {
        await fetchTodayReservations()
      } catch (cause) {
        if (cancelled) return
        if (cause instanceof Error && cause.message === "UNAUTHORIZED") {
          navigate(ROUTES.backofficeLogin, { replace: true })
          return
        }
        setTodayReservations([])
      } finally {
        if (!cancelled) setTodayFetchLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [staffLoading, fetchTodayReservations, navigate])

  const refetchTodayReservations = useCallback(async () => {
    if (staffLoading || todayRefreshing) return
    setTodayRefreshing(true)
    try {
      await fetchTodayReservations()
    } catch (cause) {
      if (cause instanceof Error && cause.message === "UNAUTHORIZED") {
        navigate(ROUTES.backofficeLogin, { replace: true })
        return
      }
      setTodayReservations([])
    } finally {
      setTodayRefreshing(false)
    }
  }, [staffLoading, todayRefreshing, fetchTodayReservations, navigate])

  if (staffLoading || todayFetchLoading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>
  }

  const updatedLabel =
    lastUpdated?.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: ADMIN_CALENDAR_TIME_ZONE,
    }) ?? ""

  const isOwner = profile.role === "owner"

  return (
    <div className="space-y-6">
      {isOwner ? <AdminOwnerFeatureHub /> : <AdminStaffFeatureHub />}
      <TodayReservationsCard
        reservations={todayReservations}
        staffList={staffList}
        updatedAtLabel={updatedLabel || undefined}
        refreshing={todayRefreshing}
        onRefresh={() => void refetchTodayReservations()}
      />
      {isOwner ? <AdminSalonSlugCard /> : null}
    </div>
  )
}
