import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import type { BusinessHoursItem } from "@/features/admin/api/adminSettingsApi"
import type { Reservation } from "@/features/admin/types/reservation"
import type { Staff } from "@/features/admin/types/staff"
import {
  ADMIN_CALENDAR_TIME_ZONE,
  combineDateAndTimeToAdminTzIso,
  formatTime,
  formatDateJa,
  formatReservationDurationJa,
  formatTimeHmInAdminTz,
  getIsoDateKeyInTimeZone,
} from "@/features/admin/lib/calendarUtils"
import {
  getReservationAssigneeDisplayName,
  getStaffById,
  isSameReservationTrainer,
  reservationStaffMatchesReservation,
  resolveReservationStaffIdForUi,
} from "@/features/admin/api/staffApi"
import { getReservationTrainerColor } from "@/features/admin/hooks/useStaff"
import {
  hasConfirmedOverlapForAssignee,
  reservationIntervalsOverlap,
} from "@/features/admin/lib/reservationOverlap"
import {
  buildStartTimeOptions,
  getBusinessHoursForJsDate,
  timeToMinutes,
} from "@/features/admin/lib/businessHours"
import {
  type AdminReservationApiStatus,
  adminReservationApiStatusLabel,
  mapReservationStatusToApiStatus,
} from "@/features/admin/api/reservationsApi"

function formatYen(amount?: number): string {
  if (typeof amount !== "number") return "-"
  return amount.toLocaleString("ja-JP", { style: "currency", currency: "JPY" })
}

function paymentProviderLabel(provider?: string): string {
  if (provider === "stripe") return "クレジットカード"
  if (provider === "credit") return "クレジットカード"
  if (provider === "paypay") return "PayPay"
  return provider || "-"
}

function paymentStatusLabel(status?: string): string {
  if (status === "succeeded") return "支払い済み"
  if (status === "refunded") return "返金済み"
  if (status === "pending") return "処理中"
  if (status === "failed") return "失敗"
  return status || "-"
}

function timeHmToMinutes(value: string): number | null {
  const [hourRaw, minuteRaw] = value.split(":")
  const hour = Number(hourRaw)
  const minute = Number(minuteRaw)
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null
  }
  return hour * 60 + minute
}

function dateYmdToJsDate(dateYmd: string): Date {
  return new Date(`${dateYmd}T12:00:00+09:00`)
}

function buildScheduleTimeOptions(
  dateYmd: string,
  businessHoursItems: BusinessHoursItem[],
  holidayDateKeys: ReadonlySet<string>,
  stepMinutes: number,
  durationMinutes: number,
): string[] {
  if (!dateYmd || holidayDateKeys.has(dateYmd)) return []
  const biz = getBusinessHoursForJsDate(businessHoursItems, dateYmdToJsDate(dateYmd))
  if (!biz || biz.isClosed) return []
  const bizEndMin = timeToMinutes(biz.end)
  return buildStartTimeOptions(biz.start, biz.end, stepMinutes).filter(
    (hm) => timeToMinutes(hm) + durationMinutes <= bizEndMin,
  )
}

interface ReservationDetailCardProps {
  reservation: Reservation
  staffList?: Staff[]
  /** 担当者の空き判定用（この予約以外の重複を見る） */
  reservations?: Reservation[]
  /** 指定時はメモを管理者が編集可能（非同期可・失敗時は編集を閉じない） */
  onUpdateMemo?: (memo: string | undefined) => void | Promise<void>
  /**
   * 指定時はステータスを編集可能（変更時は確認後に呼ぶ）。
   * `PATCH /api/admin/reservations/{id}/status` 用の値（BOOKED / DONE / NOSHOW / CANCELED）
   */
  onUpdateStatus?: (
    status: AdminReservationApiStatus,
    options?: { refundPayment?: boolean },
  ) => void | Promise<void>
  onRefundPayment?: (paymentId: string) => void | Promise<void>
  /** 指定時は担当者を編集可能（非同期可・失敗時は確認を閉じない） */
  onUpdateAssignee?: (assigneeId: string) => void | Promise<void>
  /** 指定時は予約日時を編集可能（開始日時のみ送信し、終了時刻はサーバーで再計算） */
  onUpdateSchedule?: (startAt: string) => void | Promise<void>
  /** メモ保存 API 実行中 */
  memoSaving?: boolean
  /** ステータス変更 API 実行中 */
  statusSaving?: boolean
  /** 日時変更 API 実行中 */
  scheduleSaving?: boolean
  /** 予約ルールの空き枠刻み（分） */
  slotIncrementMinutes?: number
  /** 曜日ごとの営業時間 */
  businessHoursItems?: BusinessHoursItem[]
  /** 個別休業日（YYYY-MM-DD） */
  holidayDateKeys?: ReadonlySet<string>
  refundSaving?: boolean
  /** 担当者変更 API 実行中 */
  assigneeSaving?: boolean
  /**
   * 各スタッフが予約日・予約時間帯にシフトを持つか（GET …/trainers/{id}/shifts）。
   * 未指定のときはシフトによる制限を行わない。
   */
  shiftCoverageByStaffId?: Record<string, boolean>
  /** シフト一覧取得中 */
  shiftCoverageLoading?: boolean
  /** シフト取得失敗 */
  shiftCoverageError?: boolean
}

export function ReservationDetailCard({
  reservation,
  staffList = [],
  reservations = [],
  onUpdateMemo,
  onUpdateStatus,
  onRefundPayment,
  onUpdateAssignee,
  onUpdateSchedule,
  memoSaving = false,
  statusSaving = false,
  scheduleSaving = false,
  slotIncrementMinutes = 15,
  businessHoursItems = [],
  holidayDateKeys = new Set(),
  refundSaving = false,
  assigneeSaving = false,
  shiftCoverageByStaffId,
  shiftCoverageLoading = false,
  shiftCoverageError = false,
}: ReservationDetailCardProps) {
  const startDate = new Date(reservation.startAt)
  const currentApiStatus = mapReservationStatusToApiStatus(reservation.status)
  const isDoneReservation = currentApiStatus === "DONE"
  const nowMs = Date.now()
  const startMs = new Date(reservation.startAt).getTime()
  const endMs = new Date(reservation.endAt).getTime()
  const durationMinutes =
    Number.isFinite(startMs) && Number.isFinite(endMs)
      ? Math.max(1, Math.round((endMs - startMs) / 60_000))
      : 1
  const scheduleStepMinutes = Math.max(1, slotIncrementMinutes)
  const reservationNotStarted = Number.isFinite(startMs) && startMs > nowMs
  const reservationEnded = Number.isFinite(endMs) && endMs < nowMs
  const refundable =
    Boolean(reservation.paymentId) &&
    reservation.paymentRecordStatus === "succeeded" &&
    (reservation.paymentRefundAmount ?? 0) <= 0

  const canSelectStatus = (status: AdminReservationApiStatus): boolean => {
    if (reservationNotStarted) {
      return status === "BOOKED" || status === "CANCELED"
    }
    if (reservationEnded && status === "BOOKED") return false
    return true
  }

  /** この時間帯にほかの確定予約がなければ選択可。現在の担当は常に可。 */
  const canSelectStaffForSlot = (staffId: string) =>
    isSameReservationTrainer(staffId, reservation) ||
    !hasConfirmedOverlapForAssignee(
      reservations,
      staffId,
      reservation.startAt,
      reservation.endAt,
      reservation.id,
    )

  /** シフトが予約時間を覆うか（未設定 API では制限しない）。現在の担当は常に可。 */
  const canSelectStaffByShift = (staffId: string) => {
    if (shiftCoverageByStaffId === undefined) return true
    if (isSameReservationTrainer(staffId, reservation)) return true
    if (shiftCoverageLoading) return false
    if (shiftCoverageError) return false
    return shiftCoverageByStaffId[staffId] === true
  }

  const canSelectStaffForAssignee = (staffId: string) =>
    canSelectStaffForSlot(staffId) && canSelectStaffByShift(staffId)

  const assigneeOptionTitle = (staffId: string): string | undefined => {
    if (isSameReservationTrainer(staffId, reservation)) return undefined
    if (!canSelectStaffForSlot(staffId)) {
      return "この時間帯にはすでにほかの確定予約があります"
    }
    if (shiftCoverageByStaffId === undefined) return undefined
    if (shiftCoverageLoading) return "シフトを確認しています…"
    if (shiftCoverageError) return "シフト情報を取得できませんでした"
    if (shiftCoverageByStaffId[staffId] !== true) {
      return "この日の予約時間帯にシフトが登録されていません"
    }
    return undefined
  }

  const assigneeHasOtherBookingInSlot = (staffId: string) =>
    hasConfirmedOverlapForAssignee(
      reservations,
      staffId,
      reservation.startAt,
      reservation.endAt,
      reservation.id,
    )

  const [editingMemo, setEditingMemo] = useState(false)
  const [memoDraft, setMemoDraft] = useState(reservation.memo ?? "")
  const [editingSchedule, setEditingSchedule] = useState(false)
  const [scheduleDateDraft, setScheduleDateDraft] = useState(() =>
    getIsoDateKeyInTimeZone(reservation.startAt, ADMIN_CALENDAR_TIME_ZONE),
  )
  const [scheduleTimeDraft, setScheduleTimeDraft] = useState(() =>
    formatTimeHmInAdminTz(reservation.startAt),
  )
  const [scheduleError, setScheduleError] = useState("")
  const scheduleTimeOptions = useMemo(
    () =>
      buildScheduleTimeOptions(
        scheduleDateDraft,
        businessHoursItems,
        holidayDateKeys,
        scheduleStepMinutes,
        durationMinutes,
      ),
    [
      scheduleDateDraft,
      businessHoursItems,
      holidayDateKeys,
      scheduleStepMinutes,
      durationMinutes,
    ],
  )
  const [editingStatus, setEditingStatus] = useState(false)
  const [statusDraft, setStatusDraft] = useState<AdminReservationApiStatus>(() =>
    mapReservationStatusToApiStatus(reservation.status),
  )
  const [statusRuleError, setStatusRuleError] = useState("")
  const [statusConfirm, setStatusConfirm] = useState<AdminReservationApiStatus | null>(null)
  const [refundOnCancel, setRefundOnCancel] = useState(false)
  const [refundConfirm, setRefundConfirm] = useState(false)
  const [editingAssignee, setEditingAssignee] = useState(false)
  const [assigneeDraft, setAssigneeDraft] = useState(() =>
    resolveReservationStaffIdForUi(reservation, staffList),
  )
  const [assigneeConfirm, setAssigneeConfirm] = useState<string | null>(null)
  const [assigneeSlotError, setAssigneeSlotError] = useState("")

  useEffect(() => {
    if (!editingMemo) {
      queueMicrotask(() => {
        setMemoDraft(reservation.memo ?? "")
      })
    }
  }, [reservation.memo, reservation.id, editingMemo])

  useEffect(() => {
    if (!editingStatus) {
      queueMicrotask(() => {
        setStatusDraft(mapReservationStatusToApiStatus(reservation.status))
        setStatusRuleError("")
      })
    }
  }, [reservation.status, reservation.id, editingStatus])

  useEffect(() => {
    if (!editingSchedule) {
      queueMicrotask(() => {
        setScheduleDateDraft(
          getIsoDateKeyInTimeZone(reservation.startAt, ADMIN_CALENDAR_TIME_ZONE),
        )
        setScheduleTimeDraft(formatTimeHmInAdminTz(reservation.startAt))
        setScheduleError("")
      })
    }
  }, [reservation.startAt, reservation.id, editingSchedule])

  useEffect(() => {
    if (!editingSchedule) return
    if (scheduleTimeOptions.includes(scheduleTimeDraft)) return
    queueMicrotask(() => {
      setScheduleTimeDraft(scheduleTimeOptions[0] ?? "")
    })
  }, [editingSchedule, scheduleTimeDraft, scheduleTimeOptions])

  useEffect(() => {
    if (!editingAssignee) {
      queueMicrotask(() => {
        setAssigneeDraft(resolveReservationStaffIdForUi(reservation, staffList))
      })
    }
  }, [reservation, editingAssignee, staffList])

  useEffect(() => {
    if (!isDoneReservation) return
    setEditingMemo(false)
    setEditingSchedule(false)
    setScheduleError("")
    setEditingAssignee(false)
    setAssigneeConfirm(null)
    setAssigneeSlotError("")
  }, [isDoneReservation])

  /** シフト取得後などで選択が無効になったとき、表示と state を一致させる */
  useEffect(() => {
    if (!editingAssignee) return
    const effective = staffList.some(
      (s) => s.id === assigneeDraft && canSelectStaffForAssignee(s.id),
    )
      ? assigneeDraft
      : staffList.find((s) => canSelectStaffForAssignee(s.id))?.id ??
        resolveReservationStaffIdForUi(reservation, staffList)
    if (effective !== assigneeDraft) {
      queueMicrotask(() => {
        setAssigneeDraft(effective)
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- canSelectStaffForAssignee は reservation / staffList 由来の派生
  }, [
    editingAssignee,
    assigneeDraft,
    staffList,
    reservation.assigneeId,
    reservation.trainerId,
    reservation.id,
    reservation.startAt,
    reservation.endAt,
    shiftCoverageByStaffId,
    shiftCoverageLoading,
    shiftCoverageError,
    reservations,
  ])

  const openAssigneeEdit = () => {
    setAssigneeSlotError("")
    setAssigneeDraft(resolveReservationStaffIdForUi(reservation, staffList))
    setEditingAssignee(true)
  }

  const openScheduleEdit = () => {
    setScheduleDateDraft(
      getIsoDateKeyInTimeZone(reservation.startAt, ADMIN_CALENDAR_TIME_ZONE),
    )
    setScheduleTimeDraft(formatTimeHmInAdminTz(reservation.startAt))
    setScheduleError("")
    setEditingSchedule(true)
  }

  const handleSubmitSchedule = async () => {
    if (!onUpdateSchedule) return
    if (!scheduleDateDraft || !scheduleTimeDraft) {
      setScheduleError("日付と時刻を入力してください。")
      return
    }
    if (scheduleTimeOptions.length === 0) {
      setScheduleError("この日は営業時間内に選択できる予約枠がありません。")
      return
    }
    if (!scheduleTimeOptions.includes(scheduleTimeDraft)) {
      setScheduleError("営業時間内の時刻を選択してください。")
      return
    }
    const scheduleMinutes = timeHmToMinutes(scheduleTimeDraft)
    if (scheduleMinutes === null || scheduleMinutes % scheduleStepMinutes !== 0) {
      setScheduleError(`開始時刻は${scheduleStepMinutes}分刻みで選択してください。`)
      return
    }
    const nextStartAt = combineDateAndTimeToAdminTzIso(
      scheduleDateDraft,
      scheduleTimeDraft,
    )
    if (!Number.isFinite(new Date(nextStartAt).getTime())) {
      setScheduleError("日時の形式が正しくありません。")
      return
    }
    if (new Date(nextStartAt).getTime() === new Date(reservation.startAt).getTime()) {
      setEditingSchedule(false)
      return
    }
    const nextEndAt = new Date(
      new Date(nextStartAt).getTime() + durationMinutes * 60_000,
    ).toISOString()
    const assigneeId = resolveReservationStaffIdForUi(reservation, staffList)
    const overlappingReservation = reservations.find(
      (r) =>
        r.status === "CONFIRMED" &&
        r.id !== reservation.id &&
        r.assigneeId === assigneeId &&
        reservationIntervalsOverlap(nextStartAt, nextEndAt, r.startAt, r.endAt),
    )
    if (overlappingReservation) {
      setScheduleError("この時間帯にはすでに予約があります。別の日時を選択してください。")
      return
    }
    setScheduleError("")
    try {
      await Promise.resolve(onUpdateSchedule(nextStartAt))
      setEditingSchedule(false)
    } catch {
      setScheduleError("日時の保存に失敗しました。")
    }
  }

  const detailValueClass =
    "min-h-9 rounded-md border border-border bg-background px-3 py-2 text-sm leading-5"

  return (
    <section className="space-y-4 text-sm">
      <div className="space-y-4">
        <dl className="grid grid-cols-[8rem_minmax(0,1fr)_3rem] gap-x-3 gap-y-2">
          <dt className="py-2 font-medium text-foreground">予約ID</dt>
          <dd className={`${detailValueClass} break-all text-foreground`}>
            {reservation.id}
          </dd>
          <dd aria-hidden="true" />
          <dt className="py-2 font-medium text-foreground">お客様名</dt>
          <dd className={`${detailValueClass} text-foreground`}>
            {reservation.customerName}
          </dd>
          <dd aria-hidden="true" />
          <dt className="py-2 font-medium text-foreground">メニュー</dt>
          <dd className={`${detailValueClass} text-foreground`}>
            {reservation.menuName?.trim() ? reservation.menuName : "—"}
          </dd>
          <dd aria-hidden="true" />
          {reservation.customerPhone?.trim() ? (
            <>
              <dt className="py-2 font-medium text-foreground">電話番号</dt>
              <dd className={`${detailValueClass} tabular-nums text-foreground`}>
                {reservation.customerPhone.trim()}
              </dd>
              <dd aria-hidden="true" />
            </>
          ) : null}
          <dt className="py-2 font-medium text-foreground">メール</dt>
          <dd className={`${detailValueClass} break-all text-foreground`}>
            {reservation.customerEmail}
          </dd>
          <dd aria-hidden="true" />
          <dt className="py-2 font-medium text-foreground">日時</dt>
          <dd>
            {onUpdateSchedule && editingSchedule && !isDoneReservation ? (
              <div className="space-y-2">
                <div className="grid gap-2 sm:grid-cols-[1fr_9rem]">
                  <div>
                    <Label htmlFor="reservation-schedule-date" className="sr-only">
                      予約日
                    </Label>
                    <input
                      id="reservation-schedule-date"
                      type="date"
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={scheduleDateDraft}
                      disabled={scheduleSaving}
                      onChange={(e) => {
                        setScheduleError("")
                        setScheduleDateDraft(e.target.value)
                      }}
                    />
                  </div>
                  <div>
                    <Label htmlFor="reservation-schedule-time" className="sr-only">
                      開始時刻
                    </Label>
                    <select
                      id="reservation-schedule-time"
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={scheduleTimeDraft}
                      disabled={scheduleSaving || scheduleTimeOptions.length === 0}
                      onChange={(e) => {
                        setScheduleError("")
                        setScheduleTimeDraft(e.target.value)
                      }}
                    >
                      <option value="" disabled>
                        {scheduleTimeOptions.length === 0 ? "候補なし" : "時刻を選択"}
                      </option>
                      {scheduleTimeOptions.map((time) => (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  開始時刻は営業時間内の{scheduleStepMinutes}分刻みから選択してください。終了時刻はメニューの所要時間から自動で再計算されます。
                </p>
                {scheduleError ? (
                  <p className="text-sm text-destructive" role="alert">
                    {scheduleError}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-md"
                    disabled={scheduleSaving}
                    onClick={handleSubmitSchedule}
                  >
                    {scheduleSaving ? "保存中…" : "変更する"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-md"
                    disabled={scheduleSaving}
                    onClick={() => {
                      setScheduleDateDraft(
                        getIsoDateKeyInTimeZone(
                          reservation.startAt,
                          ADMIN_CALENDAR_TIME_ZONE,
                        ),
                      )
                      setScheduleTimeDraft(formatTimeHmInAdminTz(reservation.startAt))
                      setScheduleError("")
                      setEditingSchedule(false)
                    }}
                  >
                    キャンセル
                  </Button>
                </div>
              </div>
            ) : (
              <div className={`${detailValueClass} text-foreground`}>
                <p>
                  {formatDateJa(startDate)} {formatTime(reservation.startAt)} ～{" "}
                  {formatTime(reservation.endAt)}
                </p>
                <p className="mt-0.5 text-sm leading-5 text-muted-foreground">
                  所要時間 {formatReservationDurationJa(reservation.startAt, reservation.endAt)}
                </p>
              </div>
            )}
          </dd>
          <dd className="py-1">
            {onUpdateSchedule && !editingSchedule && !isDoneReservation ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 rounded-md px-2 text-xs"
                onClick={openScheduleEdit}
              >
                編集
              </Button>
            ) : null}
          </dd>
        </dl>
        <div className="grid grid-cols-[8rem_minmax(0,1fr)_3rem] gap-x-3">
          <p className="py-2 font-medium text-foreground">担当者</p>
          <div className="space-y-2">
            {onUpdateAssignee &&
            staffList.length > 0 &&
            editingAssignee &&
            !isDoneReservation ? (
            <div className="space-y-2">
              <Label htmlFor="reservation-assignee-edit" className="sr-only">
                担当者を変更
              </Label>
              <select
                id="reservation-assignee-edit"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={assigneeDraft}
                onChange={(e) => {
                  setAssigneeSlotError("")
                  setAssigneeDraft(e.target.value)
                }}
              >
                {staffList.map((s) => {
                  const selectable = canSelectStaffForAssignee(s.id)
                  const reason = assigneeOptionTitle(s.id)
                  return (
                    <option
                      key={s.id}
                      value={s.id}
                      disabled={!selectable}
                      title={reason}
                    >
                      {s.name}
                      {!selectable
                        ? !canSelectStaffForSlot(s.id)
                          ? "（選択不可・予約あり）"
                          : shiftCoverageLoading
                            ? "（選択不可・確認中）"
                            : shiftCoverageError
                              ? "（選択不可・シフト未取得）"
                              : "（選択不可・シフトなし）"
                        : ""}
                    </option>
                  )
                })}
              </select>
              {shiftCoverageError ? (
                <p className="text-xs text-destructive">
                  シフト情報を取得できませんでした。担当変更は現在の担当のままにしてください。
                </p>
              ) : null}
              {shiftCoverageLoading ? (
                <p className="text-xs text-muted-foreground">シフトを確認しています…</p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                この予約の時間帯に、すでに確定予約が入っている担当者は選択できません。
                {shiftCoverageByStaffId !== undefined
                  ? " また、その日の予約時間にシフトが登録されていない担当者は選択できません。"
                  : null}
              </p>
              {assigneeSlotError && (
                <p className="text-sm text-destructive" role="alert">
                  {assigneeSlotError}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="rounded-md"
                  disabled={assigneeSaving}
                  onClick={() => {
                    setAssigneeSlotError("")
                    if (
                      reservationStaffMatchesReservation(
                        assigneeDraft,
                        reservation,
                        staffList,
                      )
                    ) {
                      setEditingAssignee(false)
                      return
                    }
                    const nm =
                      getStaffById(assigneeDraft, staffList)?.name ?? assigneeDraft
                    if (!canSelectStaffForSlot(assigneeDraft)) {
                      setAssigneeSlotError(
                        `「${nm}」はすでに予約が入っているため、変更できません`,
                      )
                      return
                    }
                    if (shiftCoverageByStaffId !== undefined) {
                      if (shiftCoverageLoading) {
                        setAssigneeSlotError(
                          "シフト情報を確認しています。しばらく待ってから再度お試しください。",
                        )
                        return
                      }
                      if (shiftCoverageError) {
                        setAssigneeSlotError(
                          "シフト情報を取得できませんでした。ネットワークを確認してください。",
                        )
                        return
                      }
                      if (!canSelectStaffByShift(assigneeDraft)) {
                        setAssigneeSlotError(
                          `「${nm}」はこの日の予約時間帯にシフトが登録されていないため、担当にできません`,
                        )
                        return
                      }
                    }
                    setAssigneeConfirm(assigneeDraft)
                  }}
                >
                  変更する
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-md"
                  onClick={() => {
                    setAssigneeSlotError("")
                    setAssigneeDraft(reservation.assigneeId)
                    setEditingAssignee(false)
                  }}
                >
                  キャンセル
                </Button>
              </div>
            </div>
          ) : (
            <p className={`${detailValueClass} flex items-center gap-2 text-foreground`}>
              <span
                className="inline-block size-3 shrink-0 rounded-full"
                style={{
                  backgroundColor: getReservationTrainerColor(reservation, staffList),
                }}
              />
              {getReservationAssigneeDisplayName(reservation, staffList)}
            </p>
          )}
          </div>
          <div className="py-1">
            {onUpdateAssignee &&
            staffList.length > 0 &&
            !editingAssignee &&
            !isDoneReservation ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 rounded-md px-2 text-xs"
                onClick={openAssigneeEdit}
              >
                編集
              </Button>
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-[8rem_minmax(0,1fr)_3rem] gap-x-3">
          <p className="py-2 font-medium text-foreground">ステータス</p>
          <div className="space-y-2">
            {onUpdateStatus && editingStatus ? (
            <div className="space-y-2">
              <Label htmlFor="reservation-status-edit" className="sr-only">
                ステータスを変更
              </Label>
              <select
                id="reservation-status-edit"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={statusDraft}
                onChange={(e) =>
                  setStatusDraft(e.target.value as AdminReservationApiStatus)
                }
              >
                <option value="BOOKED" disabled={!canSelectStatus("BOOKED")}>予約確定</option>
                <option value="DONE" disabled={!canSelectStatus("DONE")}>完了</option>
                <option value="NOSHOW" disabled={!canSelectStatus("NOSHOW")}>
                  ノーショー（無断キャンセル）
                </option>
                <option value="CANCELED" disabled={!canSelectStatus("CANCELED")}>キャンセル</option>
              </select>
              <p className="text-xs text-muted-foreground">
                「キャンセル」にするとカレンダーから非表示になり、キャンセル一覧に表示されます。
              </p>
              {reservationNotStarted ? (
                <p className="text-xs text-muted-foreground">
                  予約開始前は「予約確定」または「キャンセル」のみ変更できます。
                </p>
              ) : null}
              {reservationEnded ? (
                <p className="text-xs text-muted-foreground">
                  予約終了後は「予約確定」へ戻すことはできません。
                </p>
              ) : null}
              {statusRuleError ? (
                <p className="text-sm text-destructive" role="alert">
                  {statusRuleError}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="rounded-md"
                  disabled={statusSaving}
                  onClick={() => {
                    if (statusDraft === currentApiStatus) {
                      setEditingStatus(false)
                      return
                    }
                    if (!canSelectStatus(statusDraft)) {
                      setStatusRuleError(
                        reservationNotStarted
                          ? "予約開始前は「予約確定」または「キャンセル」のみ選択できます。"
                          : "予約終了後は「予約確定」に戻せません。",
                      )
                      return
                    }
                    setStatusConfirm(statusDraft)
                  }}
                >
                  変更する
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-md"
                  onClick={() => {
                    setStatusDraft(mapReservationStatusToApiStatus(reservation.status))
                    setEditingStatus(false)
                  }}
                >
                  キャンセル
                </Button>
              </div>
            </div>
          ) : (
            <p className={`${detailValueClass} text-foreground`}>
              {adminReservationApiStatusLabel(currentApiStatus)}
            </p>
          )}
          </div>
          <div className="py-1">
            {onUpdateStatus && !editingStatus ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 rounded-md px-2 text-xs"
                onClick={() => {
                  setStatusRuleError("")
                  setStatusDraft(mapReservationStatusToApiStatus(reservation.status))
                  setEditingStatus(true)
                }}
              >
                編集
              </Button>
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-[8rem_minmax(0,1fr)_3rem] gap-x-3">
          <p className="py-2 font-medium text-foreground">決済情報</p>
          <div className="space-y-2">
            {reservation.paymentId ? (
            <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-2 text-sm">
              <dt className="py-2 font-medium text-foreground">方法</dt>
              <dd className={`${detailValueClass} text-foreground`}>
                {paymentProviderLabel(reservation.paymentProvider ?? reservation.paymentMethod)}
              </dd>
              <dt className="py-2 font-medium text-foreground">状態</dt>
              <dd className={`${detailValueClass} text-foreground`}>
                {paymentStatusLabel(reservation.paymentRecordStatus ?? reservation.paymentStatus)}
              </dd>
              <dt className="py-2 font-medium text-foreground">金額</dt>
              <dd className={`${detailValueClass} text-foreground`}>
                {formatYen(reservation.paymentAmountYen)}
              </dd>
              <dt className="py-2 font-medium text-foreground">返金額</dt>
              <dd className={`${detailValueClass} text-foreground`}>
                {formatYen(reservation.paymentRefundAmount ?? 0)}
              </dd>
              {reservation.paymentPaidAt ? (
                <>
                  <dt className="py-2 font-medium text-foreground">支払日時</dt>
                  <dd className={`${detailValueClass} text-foreground`}>
                    {new Date(reservation.paymentPaidAt).toLocaleString("ja-JP")}
                  </dd>
                </>
              ) : null}
            </dl>
          ) : (
            <p className={`${detailValueClass} text-muted-foreground`}>
              この予約に紐づく決済はありません。
            </p>
          )}
          </div>
          <div className="py-1">
            {onRefundPayment && refundable ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 rounded-md px-2 text-xs"
                disabled={refundSaving}
                onClick={() => setRefundConfirm(true)}
              >
                返金
              </Button>
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-[8rem_minmax(0,1fr)_3rem] gap-x-3">
          <p className="py-2 font-medium text-foreground">メモ</p>
          <div className="space-y-2">
          {onUpdateMemo && editingMemo && !isDoneReservation ? (
            <div className="space-y-2">
              <Label htmlFor="reservation-memo-edit" className="sr-only">
                メモを編集
              </Label>
              <textarea
                id="reservation-memo-edit"
                className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={memoDraft}
                disabled={memoSaving}
                onChange={(e) => setMemoDraft(e.target.value)}
                placeholder="メモを入力（空にすると削除）"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="rounded-md"
                  disabled={memoSaving}
                  onClick={async () => {
                    const t = memoDraft.trim()
                    if (!onUpdateMemo) return
                    try {
                      await Promise.resolve(onUpdateMemo(t || undefined))
                      setEditingMemo(false)
                    } catch {
                      /* 親がエラー表示 */
                    }
                  }}
                >
                  {memoSaving ? "保存中…" : "保存"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-md"
                  onClick={() => {
                    setMemoDraft(reservation.memo ?? "")
                    setEditingMemo(false)
                  }}
                >
                  キャンセル
                </Button>
              </div>
            </div>
          ) : (
            <p className={`${detailValueClass} whitespace-pre-wrap text-muted-foreground`}>
              {reservation.memo?.trim() ? reservation.memo : "（メモはありません）"}
            </p>
          )}
          </div>
          <div className="py-1">
            {onUpdateMemo && !editingMemo && !isDoneReservation ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 rounded-md px-2 text-xs"
                onClick={() => {
                  setMemoDraft(reservation.memo ?? "")
                  setEditingMemo(true)
                }}
              >
                編集
              </Button>
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-[8rem_minmax(0,1fr)_3rem] gap-x-3">
          <p className="py-2 font-medium text-foreground">予約作成日時</p>
          <p className={`${detailValueClass} text-foreground`}>
            {new Date(reservation.createdAt).toLocaleString("ja-JP")}
          </p>
          <div />
        </div>
      </div>

      {statusConfirm && onUpdateStatus && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="status-confirm-title"
          onClick={() => setStatusConfirm(null)}
        >
          <Card
            className="w-full max-w-md border-border shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <CardTitle id="status-confirm-title" className="text-base">
                ステータス変更の確認
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">
                この予約のステータスを「
                <strong>
                  {statusConfirm ? adminReservationApiStatusLabel(statusConfirm) : ""}
                </strong>
                」に変更しますか？
              </p>
              {statusConfirm === "CANCELED" && refundable ? (
                <label className="flex items-start gap-2 rounded-md border border-border p-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1 size-4"
                    checked={refundOnCancel}
                    onChange={(e) => setRefundOnCancel(e.target.checked)}
                  />
                  <span>
                    <span className="block font-medium">同時に返金する</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatYen(reservation.paymentAmountYen)} の決済を返金します。
                    </span>
                  </span>
                </label>
              ) : null}
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-md"
                  onClick={() => setStatusConfirm(null)}
                >
                  いいえ
                </Button>
                <Button
                  type="button"
                  className="rounded-md"
                  disabled={statusSaving}
                  onClick={async () => {
                    if (!statusConfirm || !onUpdateStatus) return
                    try {
                      await Promise.resolve(
                        onUpdateStatus(statusConfirm, {
                          refundPayment: statusConfirm === "CANCELED" && refundOnCancel,
                        }),
                      )
                      setStatusConfirm(null)
                      setEditingStatus(false)
                      setRefundOnCancel(false)
                    } catch {
                      /* 親がエラー表示 */
                    }
                  }}
                >
                  {statusSaving ? "保存中…" : "はい"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {refundConfirm && onRefundPayment && reservation.paymentId ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="refund-confirm-title"
          onClick={() => setRefundConfirm(false)}
        >
          <Card
            className="w-full max-w-md border-border shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <CardTitle id="refund-confirm-title" className="text-base">
                返金の確認
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">
                {formatYen(reservation.paymentAmountYen)} の決済を返金します。
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-md"
                  onClick={() => setRefundConfirm(false)}
                >
                  いいえ
                </Button>
                <Button
                  type="button"
                  className="rounded-md"
                  disabled={refundSaving}
                  onClick={async () => {
                    if (!reservation.paymentId) return
                    try {
                      await Promise.resolve(onRefundPayment(reservation.paymentId))
                      setRefundConfirm(false)
                    } catch {
                      /* parent shows error */
                    }
                  }}
                >
                  {refundSaving ? "処理中..." : "返金する"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {assigneeConfirm && onUpdateAssignee && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="assignee-confirm-title"
          onClick={() => setAssigneeConfirm(null)}
        >
          <Card
            className="w-full max-w-md border-border shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <CardTitle id="assignee-confirm-title" className="text-base">
                担当者変更の確認
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">
                担当者を「
                <strong>
                  {getStaffById(assigneeConfirm, staffList)?.name ?? assigneeConfirm}
                </strong>
                」に変更しますか？
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-md"
                  onClick={() => setAssigneeConfirm(null)}
                >
                  いいえ
                </Button>
                <Button
                  type="button"
                  className="rounded-md"
                  disabled={assigneeSaving}
                  onClick={async () => {
                    if (assigneeHasOtherBookingInSlot(assigneeConfirm)) {
                      const nm =
                        getStaffById(assigneeConfirm, staffList)?.name ??
                        assigneeConfirm
                      setAssigneeConfirm(null)
                      setAssigneeSlotError(
                        `「${nm}」はすでに予約が入っているため、変更できません`,
                      )
                      return
                    }
                    if (shiftCoverageByStaffId !== undefined && assigneeConfirm !== reservation.assigneeId) {
                      if (!canSelectStaffByShift(assigneeConfirm)) {
                        const nm =
                          getStaffById(assigneeConfirm, staffList)?.name ??
                          assigneeConfirm
                        setAssigneeConfirm(null)
                        setAssigneeSlotError(
                          `「${nm}」はこの日の予約時間帯にシフトが登録されていないため、担当にできません`,
                        )
                        return
                      }
                    }
                    if (!onUpdateAssignee) return
                    try {
                      await Promise.resolve(onUpdateAssignee(assigneeConfirm))
                      setAssigneeConfirm(null)
                      setEditingAssignee(false)
                      setAssigneeSlotError("")
                    } catch {
                      /* 親がエラー表示 */
                    }
                  }}
                >
                  {assigneeSaving ? "保存中…" : "はい"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  )
}
