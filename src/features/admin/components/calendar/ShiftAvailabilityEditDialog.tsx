import { useLayoutEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { ShiftRegisterConfirmDialog } from "@/features/admin/components/calendar/ShiftRegisterConfirmDialog"
import { isShiftRegisterableDay } from "@/features/admin/lib/shiftDatePolicy"
import { ShiftTimeRangeFields } from "@/features/admin/components/calendar/ShiftTimeRangeFields"
import { formatTimeRangeInAdminCalendarTz, toDateKey } from "@/features/admin/lib/calendarUtils"
import type { ResolvedShiftDay } from "@/features/admin/context/AdminShiftAvailabilityContext"
import type { AvailabilitySlot } from "@/features/admin/lib/shiftAvailability"
import type { BusinessWindowForDay } from "@/features/admin/lib/businessHours"
import {
  padTimePart,
  shiftSlotWithinBusinessHours,
  timeToMinutes,
} from "@/features/admin/lib/businessHours"
import {
  getReservationsBlockingShiftRemoval,
  getReservationsOutsideShiftWindow,
} from "@/features/admin/lib/shiftReservationConflict"
import type { Reservation } from "@/features/admin/types/reservation"
import type { Staff } from "@/features/admin/types/staff"

export type ShiftEditCommit =
  | { type: "save"; slot: AvailabilitySlot }
  | { type: "off" }

interface ShiftAvailabilityEditDialogProps {
  open: boolean
  staff: Staff | null
  day: Date | null
  resolved: ResolvedShiftDay | null
  /** その日の営業時間（`GET /api/admin/settings` の business_hours） */
  businessDay: BusinessWindowForDay | null
  settingsLoading: boolean
  /** シフトと予約の整合チェック用（`GET /api/admin/reservations` 相当） */
  reservations: Reservation[]
  reservationsLoading: boolean
  reservationsFetchFailed: boolean
  onClose: () => void
  onCommit: (commit: ShiftEditCommit) => Promise<void>
}

export function ShiftAvailabilityEditDialog({
  open,
  staff,
  day,
  resolved,
  businessDay,
  settingsLoading,
  reservations,
  reservationsLoading,
  reservationsFetchFailed,
  onClose,
  onCommit,
}: ShiftAvailabilityEditDialogProps) {
  const [start, setStart] = useState("10:00")
  const [end, setEnd] = useState("19:00")
  const [initialStart, setInitialStart] = useState("10:00")
  const [initialEnd, setInitialEnd] = useState("19:00")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingCommit, setPendingCommit] = useState<ShiftEditCommit | null>(null)

  const biz = businessDay && !businessDay.isClosed ? businessDay : null

  /** 描画前に同期し、カレンダー表示と編集欄の時刻のずれを防ぐ */
  useLayoutEffect(() => {
    if (!open || !resolved) return
    setError(null)
    setConfirmOpen(false)
    setPendingCommit(null)
    let s: string
    let e: string
    if (resolved.kind === "work") {
      s = padTimePart(resolved.slot.start)
      e = padTimePart(resolved.slot.end)
    } else {
      const b = businessDay && !businessDay.isClosed ? businessDay : null
      s = b ? padTimePart(b.start) : "10:00"
      e = b ? padTimePart(b.end) : "19:00"
    }
    setStart(s)
    setEnd(e)
    setInitialStart(s)
    setInitialEnd(e)
  }, [open, resolved, businessDay])

  if (!open || !staff || !day || !resolved) return null

  const dateLabel = `${day.getFullYear()}年${day.getMonth() + 1}月${day.getDate()}日`

  const runCommit = async (commit: ShiftEditCommit) => {
    setSaving(true)
    setError(null)
    try {
      await onCommit(commit)
      setConfirmOpen(false)
      setPendingCommit(null)
      onClose()
    } catch (e) {
      if (e instanceof Error && e.message === "UNAUTHORIZED") {
        return
      }
      if (e instanceof Error && e.message === "PAST_DATE") {
        setError("当日以前の日付にはシフトを登録・変更できません。")
        return
      }
      setError("保存に失敗しました。通信またはサーバーを確認してください。")
    } finally {
      setSaving(false)
    }
  }

  const handleSave = () => {
    if (day && !isShiftRegisterableDay(day)) {
      setError("当日以前の日付にはシフトを登録・変更できません。")
      return
    }
    if (settingsLoading || !businessDay) {
      setError("営業時間を読み込み中です。しばらく待ってから再度お試しください。")
      return
    }
    if (businessDay.isClosed) {
      setError("この日は定休日のため、勤務シフトを登録できません。")
      return
    }
    const a = padTimePart(start)
    const b = padTimePart(end)
    if (timeToMinutes(b) <= timeToMinutes(a)) {
      setError("終了時刻は開始時刻より後にしてください。")
      return
    }
    const slot: AvailabilitySlot = { start: a, end: b }
    if (
      !shiftSlotWithinBusinessHours(slot, {
        start: businessDay.start,
        end: businessDay.end,
      })
    ) {
      setError(
        `シフトは営業時間（${businessDay.start}〜${businessDay.end}）の範囲内で入力してください。`,
      )
      return
    }
    if (reservationsFetchFailed) {
      setError(
        "予約一覧を取得できなかったため、シフトを保存できません。しばらくしてから再度お試しください。",
      )
      return
    }
    if (reservationsLoading) {
      setError("予約情報を読み込み中です。しばらく待ってから再度お試しください。")
      return
    }
    const outside = getReservationsOutsideShiftWindow(
      reservations,
      staff.id,
      day,
      a,
      b,
    )
    if (outside.length > 0) {
      const first = outside[0]
      const range = formatTimeRangeInAdminCalendarTz(first.startAt, first.endAt)
      setError(
        outside.length === 1
          ? `既に予約が入っているためシフトを変更できません。（該当: ${range}）`
          : `既に予約が入っているためシフトを変更できません。（該当: ${range} ほか${outside.length - 1}件）`,
      )
      return
    }
    const timesChanged =
      padTimePart(a) !== initialStart || padTimePart(b) !== initialEnd
    const needsConfirm = resolved.kind !== "work" || timesChanged

    if (needsConfirm) {
      setPendingCommit({ type: "save", slot })
      setConfirmOpen(true)
      return
    }
    void runCommit({ type: "save", slot })
  }

  const handleConfirmRegister = () => {
    if (!pendingCommit) return
    void runCommit(pendingCommit)
  }

  const handleOff = () => {
    if (day && !isShiftRegisterableDay(day)) {
      setError("当日以前の日付にはシフトを登録・変更できません。")
      return
    }
    if (reservationsFetchFailed) {
      setError(
        "予約一覧を取得できなかったため、シフトを休みにできません。しばらくしてから再度お試しください。",
      )
      return
    }
    if (reservationsLoading) {
      setError("予約情報を読み込み中です。しばらく待ってから再度お試しください。")
      return
    }
    const blocking = getReservationsBlockingShiftRemoval(reservations, staff.id, day)
    if (blocking.length > 0) {
      const first = blocking[0]
      const range = formatTimeRangeInAdminCalendarTz(first.startAt, first.endAt)
      setError(
        `この担当者には、この日に予約が入っているため、シフトを「休みにする」ことはできません。${blocking.length === 1 ? `（該当: ${range}）` : `（例: ${range} ほか${blocking.length - 1}件）`}`,
      )
      return
    }
    void runCommit({ type: "off" })
  }

  const disabledFields = saving || settingsLoading || businessDay?.isClosed || !biz

  const saveDisabled =
    saving ||
    settingsLoading ||
    businessDay?.isClosed ||
    !biz ||
    !businessDay ||
    reservationsLoading ||
    reservationsFetchFailed

  const offDisabled = saving || reservationsLoading || reservationsFetchFailed

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={() => !saving && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shift-edit-title"
        className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="shift-edit-title" className="text-lg font-semibold">
          シフトの編集
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {staff.name} · {dateLabel}（{toDateKey(day)}）
        </p>

        {settingsLoading ? (
          <p className="mt-3 text-sm text-muted-foreground">営業時間を読み込み中…</p>
        ) : businessDay?.isClosed ? (
          <div className="mt-3 space-y-1">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              この日は定休日です。勤務シフトの新規登録・変更はできません（登録済みシフトの削除は「休みにする」から行えます）。
            </p>
            {reservationsFetchFailed ? (
              <p className="text-xs text-destructive">
                予約一覧の取得に失敗しました。シフトの保存・「休みにする」はできません。
              </p>
            ) : reservationsLoading ? (
              <p className="text-xs text-muted-foreground">予約情報を確認しています…</p>
            ) : null}
          </div>
        ) : biz ? (
          <div className="mt-3 space-y-1">
            <p className="text-xs text-muted-foreground">
              営業時間: {biz.start} 〜 {biz.end}
            </p>
            {reservationsFetchFailed ? (
              <p className="text-xs text-destructive">
                予約一覧の取得に失敗しました。シフトの保存・「休みにする」はできません。
              </p>
            ) : reservationsLoading ? (
              <p className="text-xs text-muted-foreground">予約情報を確認しています…</p>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-sm text-destructive">
            この日の営業時間が取得できませんでした。
          </p>
        )}

        <div className="mt-4">
          <ShiftTimeRangeFields
            start={start}
            end={end}
            onStartChange={setStart}
            onEndChange={setEnd}
            businessWindow={biz}
            disabled={disabledFields}
          />
          {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
            キャンセル
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={offDisabled}
            onClick={() => void handleOff()}
          >
            休みにする
          </Button>
          <Button type="button" disabled={saveDisabled} onClick={() => void handleSave()}>
            {saving ? "保存中…" : "保存"}
          </Button>
        </div>
      </div>

      <ShiftRegisterConfirmDialog
        open={confirmOpen}
        saving={saving}
        summary={
          staff && day && pendingCommit?.type === "save" ? (
            <dl className="space-y-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
              <div className="flex gap-2">
                <dt className="shrink-0 text-muted-foreground">スタッフ</dt>
                <dd>{staff.name}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="shrink-0 text-muted-foreground">日付</dt>
                <dd>{toDateKey(day)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="shrink-0 text-muted-foreground">勤務時間</dt>
                <dd>
                  {pendingCommit.slot.start} 〜 {pendingCommit.slot.end}
                </dd>
              </div>
            </dl>
          ) : null
        }
        onCancel={() => {
          if (!saving) {
            setConfirmOpen(false)
            setPendingCommit(null)
          }
        }}
        onConfirm={handleConfirmRegister}
      />
    </div>
  )
}
