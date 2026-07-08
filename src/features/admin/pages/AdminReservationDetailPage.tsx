import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import { Card, CardContent } from "@/components/ui/card"
import { ROUTES } from "@/constants/routes"
import {
  fetchTrainerShifts,
  groupTrainerShiftRowsByDate,
} from "@/features/admin/api/trainerShiftsApi"
import {
  type AdminReservationApiStatus,
  fetchAllReservationsForAdmin,
  fetchAdminReservationById,
  patchAdminReservationStatus,
  postAdminPaymentRefund,
  putAdminReservationNotes,
  putAdminReservationStartAt,
  putAdminReservationTrainerId,
} from "@/features/admin/api/reservationsApi"
import { ReservationDetailCard } from "@/features/admin/components/ReservationDetailCard"
import {
  ADMIN_CALENDAR_TIME_ZONE,
  getIsoDateKeyInTimeZone,
} from "@/features/admin/lib/calendarUtils"
import { reservationFullyWithinTrainerShifts } from "@/features/admin/lib/reservationShiftCoverage"
import { appendReservationOperationLogFile } from "@/features/admin/lib/reservationOperationLogFile"
import { useAdminReservations } from "@/features/admin/context/AdminReservationsContext"
import { useAdminProfile } from "@/features/auth/context/AdminProfileContext"
import { useStaff } from "@/features/admin/hooks/useStaff"
import {
  type BusinessHoursItem,
  fetchAdminBookingRules,
  fetchAdminSettings,
} from "@/features/admin/api/adminSettingsApi"
import type { Reservation } from "@/features/admin/types/reservation"

export function AdminReservationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { reservations, replaceReservations } = useAdminReservations()
  const profile = useAdminProfile()
  const reservationsRef = useRef(reservations)
  reservationsRef.current = reservations
  const { staffList, loading: staffLoading } = useStaff()

  const [detail, setDetail] = useState<Reservation | null>(null)
  const [detailLoading, setDetailLoading] = useState(true)
  const [detailError, setDetailError] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [memoSaving, setMemoSaving] = useState(false)
  const [statusSaving, setStatusSaving] = useState(false)
  const [refundSaving, setRefundSaving] = useState(false)
  const [assigneeSaving, setAssigneeSaving] = useState(false)
  const [scheduleSaving, setScheduleSaving] = useState(false)
  const [slotIncrementMinutes, setSlotIncrementMinutes] = useState(15)
  const [businessHoursItems, setBusinessHoursItems] = useState<BusinessHoursItem[]>([])
  const [holidayDateKeys, setHolidayDateKeys] = useState<Set<string>>(new Set())
  const [assigneeValidationReservations, setAssigneeValidationReservations] = useState<
    Reservation[]
  >([])
  const [shiftCoverageByStaffId, setShiftCoverageByStaffId] = useState<
    Record<string, boolean>
  >({})
  const [shiftCoverageLoading, setShiftCoverageLoading] = useState(true)
  const [shiftCoverageError, setShiftCoverageError] = useState(false)

  const mergeReservationIntoList = (fresh: Reservation) => {
    const prev = reservationsRef.current
    replaceReservations(
      prev.some((r) => r.id === fresh.id)
        ? prev.map((r) => (r.id === fresh.id ? fresh : r))
        : [...prev, fresh],
    )
  }

  useEffect(() => {
    if (!id || staffLoading) return
    let cancelled = false
    void (async () => {
      setDetailLoading(true)
      setDetailError(false)
      try {
        const r = await fetchAdminReservationById(id, staffList)
        if (cancelled) return
        setDetail(r)
      } catch (e) {
        if (cancelled) return
        if (e instanceof Error && e.message === "UNAUTHORIZED") {
          navigate(ROUTES.backofficeLogin, { replace: true })
          return
        }
        setDetailError(true)
        setDetail(null)
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, staffList, staffLoading, navigate])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [settings, rules] = await Promise.all([
          fetchAdminSettings(),
          fetchAdminBookingRules(),
        ])
        if (cancelled) return
        setBusinessHoursItems(settings.business_hours)
        setHolidayDateKeys(new Set(settings.holidays))
        if (rules?.slot_increment_minutes) {
          setSlotIncrementMinutes(rules.slot_increment_minutes)
        }
      } catch (e) {
        if (cancelled) return
        if (e instanceof Error && e.message === "UNAUTHORIZED") {
          navigate(ROUTES.backofficeLogin, { replace: true })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [navigate])

  useEffect(() => {
    if (!detail || staffLoading) {
      if (!detail) {
        setShiftCoverageByStaffId({})
        setShiftCoverageLoading(false)
        setShiftCoverageError(false)
      }
      return
    }
    if (staffList.length === 0) {
      setShiftCoverageLoading(false)
      setShiftCoverageByStaffId({})
      return
    }
    let cancelled = false
    const dateKey = getIsoDateKeyInTimeZone(detail.startAt, ADMIN_CALENDAR_TIME_ZONE)

    void (async () => {
      setShiftCoverageLoading(true)
      setShiftCoverageError(false)
      try {
        const results = await Promise.all(
          staffList.map((s) =>
            fetchTrainerShifts(s.id, { dateFrom: dateKey, dateTo: dateKey }),
          ),
        )
        if (cancelled) return
        const next: Record<string, boolean> = {}
        staffList.forEach((s, i) => {
          const byDate = groupTrainerShiftRowsByDate(results[i], s.id)
          const dayRows = byDate[dateKey] ?? []
          next[s.id] = reservationFullyWithinTrainerShifts(
            detail.startAt,
            detail.endAt,
            dayRows,
          )
        })
        setShiftCoverageByStaffId(next)
      } catch (e) {
        if (cancelled) return
        if (e instanceof Error && e.message === "UNAUTHORIZED") {
          navigate(ROUTES.backofficeLogin, { replace: true })
          return
        }
        setShiftCoverageError(true)
        setShiftCoverageByStaffId({})
      } finally {
        if (!cancelled) setShiftCoverageLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [detail, staffList, staffLoading, navigate])

  useEffect(() => {
    if (!detail || staffLoading) return
    let cancelled = false
    void (async () => {
      try {
        const all = await fetchAllReservationsForAdmin(staffList)
        if (cancelled) return
        setAssigneeValidationReservations(all)
      } catch (e) {
        if (cancelled) return
        if (e instanceof Error && e.message === "UNAUTHORIZED") {
          navigate(ROUTES.backofficeLogin, { replace: true })
          return
        }
        // 判定用データが取得できない場合はサーバー側最終チェックに委譲
        setAssigneeValidationReservations([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [detail, staffList, staffLoading, navigate])

  const reservationsForOverlap = useMemo(() => {
    if (!detail) return reservations
    if (reservations.some((r) => r.id === detail.id)) return reservations
    return [...reservations, detail]
  }, [reservations, detail])

  if (!id) {
    return (
      <p className="text-sm text-muted-foreground">
        予約IDが指定されていません。
      </p>
    )
  }

  if (staffLoading || detailLoading) {
    return (
      <p className="text-sm text-muted-foreground">
        予約詳細を読み込み中です...
      </p>
    )
  }

  if (detailError) {
    return (
      <Card className="border-border shadow-xs">
        <CardContent className="py-6 text-sm text-muted-foreground">
          予約詳細の取得に失敗しました。ネットワークまたはサーバーを確認してください。
        </CardContent>
      </Card>
    )
  }

  if (!detail) {
    return (
      <Card className="border-border shadow-xs">
        <CardContent className="py-6 text-sm text-muted-foreground">
          指定された予約が見つかりませんでした。
        </CardContent>
      </Card>
    )
  }

  const handleUpdateMemo = async (memo: string | undefined) => {
    if (detail.status === "COMPLETED") {
      setSaveError("完了済み予約のため、メモは変更できません。")
      return
    }
    setSaveError(null)
    setMemoSaving(true)
    try {
      await putAdminReservationNotes(
        detail.id,
        memo?.trim() ? memo.trim() : null,
      )
      const fresh = await fetchAdminReservationById(id, staffList)
      if (!fresh) {
        throw new Error("FETCH_FAILED")
      }
      setDetail(fresh)
      mergeReservationIntoList(fresh)
      const actor = profile.name.trim() || "管理者"
      const nextMemo = memo?.trim() ? memo.trim() : "（空）"
      const log = {
        timestamp: new Date().toISOString(),
        actor,
        action: "memo_updated" as const,
        message: `メモを更新: ${nextMemo}`,
      }
      await appendReservationOperationLogFile({ reservationId: detail.id, ...log })
    } catch (e) {
      if (e instanceof Error && e.message === "UNAUTHORIZED") {
        navigate(ROUTES.backofficeLogin, { replace: true })
        return
      }
      setSaveError("メモの保存に失敗しました。通信またはサーバーを確認してください。")
      throw e
    } finally {
      setMemoSaving(false)
    }
  }

  const handleUpdateStatus = async (
    apiStatus: AdminReservationApiStatus,
    options?: { refundPayment?: boolean },
  ) => {
    if (!detail || !id) return
    const nowMs = Date.now()
    const startMs = new Date(detail.startAt).getTime()
    const endMs = new Date(detail.endAt).getTime()
    const reservationNotStarted = Number.isFinite(startMs) && startMs > nowMs
    const reservationEnded = Number.isFinite(endMs) && endMs < nowMs
    if (reservationNotStarted && !(apiStatus === "BOOKED" || apiStatus === "CANCELED")) {
      setSaveError("予約開始前は「予約確定」または「キャンセル」のみ変更できます。")
      return
    }
    if (reservationEnded && apiStatus === "BOOKED") {
      setSaveError("予約終了後は「予約確定」に戻せません。")
      return
    }
    setSaveError(null)
    setStatusSaving(true)
    try {
      await patchAdminReservationStatus(detail.id, apiStatus, options)
      const fresh = await fetchAdminReservationById(id, staffList)
      if (!fresh) {
        throw new Error("FETCH_FAILED")
      }
      setDetail(fresh)
      mergeReservationIntoList(fresh)
      const actor = profile.name.trim() || "管理者"
      const log = {
        timestamp: new Date().toISOString(),
        actor,
        action: "status_changed" as const,
        message: `ステータスを ${apiStatus} に変更`,
      }
      await appendReservationOperationLogFile({ reservationId: detail.id, ...log })
    } catch (e) {
      if (e instanceof Error && e.message === "UNAUTHORIZED") {
        navigate(ROUTES.backofficeLogin, { replace: true })
        return
      }
      setSaveError(
        "ステータスの変更に失敗しました。通信またはサーバーを確認してください。",
      )
      throw e
    } finally {
      setStatusSaving(false)
    }
  }

  const handleUpdateSchedule = async (startAt: string) => {
    if (detail.status === "COMPLETED") {
      setSaveError("完了済み予約のため、日時は変更できません。")
      return
    }
    setSaveError(null)
    setScheduleSaving(true)
    try {
      await putAdminReservationStartAt(detail.id, startAt)
      const fresh = await fetchAdminReservationById(id, staffList)
      if (!fresh) {
        throw new Error("FETCH_FAILED")
      }
      setDetail(fresh)
      mergeReservationIntoList(fresh)
      const actor = profile.name.trim() || "管理者"
      const log = {
        timestamp: new Date().toISOString(),
        actor,
        action: "schedule_changed" as const,
        message: `日時を ${new Date(startAt).toLocaleString("ja-JP")} に変更`,
      }
      await appendReservationOperationLogFile({ reservationId: detail.id, ...log })
    } catch (e) {
      if (e instanceof Error && e.message === "UNAUTHORIZED") {
        navigate(ROUTES.backofficeLogin, { replace: true })
        return
      }
      setSaveError(
        e instanceof Error && e.message && e.message !== "FETCH_FAILED"
          ? `日時の変更に失敗しました: ${e.message}`
          : "日時の変更に失敗しました。通信またはサーバーを確認してください。",
      )
      throw e
    } finally {
      setScheduleSaving(false)
    }
  }

  const handleRefundPayment = async (paymentId: string) => {
    if (!detail || !id) return
    setSaveError(null)
    setRefundSaving(true)
    try {
      await postAdminPaymentRefund(paymentId)
      const fresh = await fetchAdminReservationById(id, staffList)
      if (!fresh) {
        throw new Error("FETCH_FAILED")
      }
      setDetail(fresh)
      mergeReservationIntoList(fresh)
      const actor = profile.name.trim() || "管理者"
      const log = {
        timestamp: new Date().toISOString(),
        actor,
        action: "status_changed" as const,
        message: "決済を返金しました",
      }
      await appendReservationOperationLogFile({ reservationId: detail.id, ...log })
    } catch (e) {
      if (e instanceof Error && e.message === "UNAUTHORIZED") {
        navigate(ROUTES.backofficeLogin, { replace: true })
        return
      }
      setSaveError(
        e instanceof Error && e.message && e.message !== "FETCH_FAILED"
          ? `返金に失敗しました: ${e.message}`
          : "返金に失敗しました。通信またはサーバーを確認してください。",
      )
      throw e
    } finally {
      setRefundSaving(false)
    }
  }

  const handleUpdateAssignee = async (assigneeId: string) => {
    if (detail.status === "COMPLETED") {
      setSaveError("完了済み予約のため、担当者は変更できません。")
      return
    }
    setSaveError(null)
    setAssigneeSaving(true)
    try {
      await putAdminReservationTrainerId(detail.id, assigneeId)
      const fresh = await fetchAdminReservationById(id, staffList)
      if (!fresh) {
        throw new Error("FETCH_FAILED")
      }
      setDetail(fresh)
      mergeReservationIntoList(fresh)
      const actor = profile.name.trim() || "管理者"
      const assigneeName =
        staffList.find((s) => s.id === assigneeId)?.name ?? assigneeId
      const log = {
        timestamp: new Date().toISOString(),
        actor,
        action: "assignee_changed" as const,
        message: `担当者を ${assigneeName} に変更`,
      }
      await appendReservationOperationLogFile({ reservationId: detail.id, ...log })
    } catch (e) {
      if (e instanceof Error && e.message === "UNAUTHORIZED") {
        navigate(ROUTES.backofficeLogin, { replace: true })
        return
      }
      setSaveError(
        e instanceof Error && e.message && e.message !== "FETCH_FAILED"
          ? `担当者の変更に失敗しました: ${e.message}`
          : "担当者の変更に失敗しました。通信またはサーバーを確認してください。",
      )
      throw e
    } finally {
      setAssigneeSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">予約詳細</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          予約内容の確認、担当者・ステータス・メモ・決済情報を管理します。
        </p>
      </div>

      {saveError ? (
        <p className="text-sm text-destructive" role="alert">
          {saveError}
        </p>
      ) : null}

      <ReservationDetailCard
        reservation={detail}
        staffList={staffList}
        reservations={
          assigneeValidationReservations.length > 0
            ? assigneeValidationReservations
            : reservationsForOverlap
        }
        onUpdateMemo={handleUpdateMemo}
        onUpdateStatus={handleUpdateStatus}
        onUpdateSchedule={handleUpdateSchedule}
        onRefundPayment={handleRefundPayment}
        onUpdateAssignee={handleUpdateAssignee}
        memoSaving={memoSaving}
        statusSaving={statusSaving}
        scheduleSaving={scheduleSaving}
        slotIncrementMinutes={slotIncrementMinutes}
        businessHoursItems={businessHoursItems}
        holidayDateKeys={holidayDateKeys}
        refundSaving={refundSaving}
        assigneeSaving={assigneeSaving}
        shiftCoverageByStaffId={shiftCoverageByStaffId}
        shiftCoverageLoading={shiftCoverageLoading}
        shiftCoverageError={shiftCoverageError}
      />
    </div>
  )
}
