import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import type { BusinessHoursItem } from "@/features/admin/api/adminSettingsApi"
import { applyBulkMonthPlan } from "@/features/admin/api/trainerShiftsApi"
import { ShiftRegisterConfirmDialog } from "@/features/admin/components/calendar/ShiftRegisterConfirmDialog"
import { ShiftTimeRangeFields } from "@/features/admin/components/calendar/ShiftTimeRangeFields"
import { useAdminShiftAvailability } from "@/features/admin/context/AdminShiftAvailabilityContext"
import {
  buildBulkMonthPlan,
  defaultBulkSlot,
  defaultWeekdayMask,
} from "@/features/admin/lib/shiftBulkMonth"
import {
  padTimePart,
  shiftSlotWithinBusinessHours,
  timeToMinutes,
} from "@/features/admin/lib/businessHours"
import { WEEKDAY_LABELS } from "@/features/admin/lib/calendarUtils"
import type { AvailabilitySlot } from "@/features/admin/lib/shiftAvailability"
import type { Reservation } from "@/features/admin/types/reservation"
import type { Staff } from "@/features/admin/types/staff"
import { cn } from "@/lib/utils"

const selectClassName = cn(
  "border-input bg-background h-9 min-w-[4.5rem] rounded-md border px-2 text-sm shadow-xs",
  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
)

interface ShiftBulkMonthPanelProps {
  monthAnchor: Date
  monthLabel: string
  editableStaff: Staff[]
  businessHoursItems: BusinessHoursItem[]
  holidayDateKeys: ReadonlySet<string>
  settingsLoading: boolean
  settingsError: boolean
  reservations: Reservation[]
  reservationsLoading: boolean
  reservationsFetchFailed: boolean
  onApplied: () => void
}

export function ShiftBulkMonthPanel({
  monthAnchor,
  monthLabel,
  editableStaff,
  businessHoursItems,
  holidayDateKeys,
  settingsLoading,
  settingsError,
  reservations,
  reservationsLoading,
  reservationsFetchFailed,
  onApplied,
}: ShiftBulkMonthPanelProps) {
  const { apiShiftRows, setOverride } = useAdminShiftAvailability()
  const [staffId, setStaffId] = useState("")
  const [start, setStart] = useState("10:00")
  const [end, setEnd] = useState("19:00")
  const [weekdayMask, setWeekdayMask] = useState<Set<number>>(() => new Set())
  const [error, setError] = useState<string | null>(null)
  const [resultMessage, setResultMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  const selectedStaff = editableStaff.find((s) => s.id === staffId) ?? editableStaff[0] ?? null

  useEffect(() => {
    const def = defaultBulkSlot(businessHoursItems)
    setStart(def.start)
    setEnd(def.end)
    setWeekdayMask(new Set(defaultWeekdayMask(businessHoursItems)))
    if (editableStaff.length > 0) {
      setStaffId((prev) =>
        editableStaff.some((s) => s.id === prev) ? prev : editableStaff[0].id,
      )
    }
  }, [businessHoursItems, editableStaff])

  const slot: AvailabilitySlot = useMemo(
    () => ({ start: padTimePart(start), end: padTimePart(end) }),
    [start, end],
  )

  const referenceBiz = useMemo(() => {
    for (let dow = 0; dow < 7; dow++) {
      const row = businessHoursItems.find((h) => h.day_of_week === dow && !h.is_closed)
      if (row) return { start: row.start_time.slice(0, 5), end: row.end_time.slice(0, 5) }
    }
    return { start: "09:00", end: "21:00" }
  }, [businessHoursItems])

  /** 曜日ごとの定休（`business_hours.is_closed`） */
  const closedWeekdays = useMemo(() => {
    const closed = new Set<number>()
    for (const row of businessHoursItems) {
      if (row.is_closed) closed.add(row.day_of_week)
    }
    return closed
  }, [businessHoursItems])

  const reservationsReady = !reservationsLoading && !reservationsFetchFailed

  const clearResultOnTimeChange = () => setResultMessage(null)

  const plan = useMemo(() => {
    if (!selectedStaff) return null
    return buildBulkMonthPlan({
      monthAnchor,
      trainerId: selectedStaff.id,
      slot,
      weekdayMask,
      businessHoursItems,
      holidayDateKeys,
      apiShiftRows: apiShiftRows[selectedStaff.id] ?? {},
      reservations,
      reservationsReady,
    })
  }, [
    selectedStaff,
    monthAnchor,
    slot,
    weekdayMask,
    businessHoursItems,
    holidayDateKeys,
    apiShiftRows,
    reservations,
    reservationsReady,
  ])

  const toggleWeekday = (dow: number) => {
    if (closedWeekdays.has(dow)) return
    setWeekdayMask((prev) => {
      const next = new Set(prev)
      if (next.has(dow)) next.delete(dow)
      else next.add(dow)
      return next
    })
    setResultMessage(null)
  }

  const validateBeforeConfirm = useCallback((): boolean => {
    if (!selectedStaff || !plan) return false
    if (settingsLoading || settingsError) {
      setError("営業時間を取得できていないため、一括登録できません。")
      return false
    }
    if (timeToMinutes(end) <= timeToMinutes(start)) {
      setError("終了時刻は開始時刻より後にしてください。")
      return false
    }
    if (!shiftSlotWithinBusinessHours(slot, referenceBiz)) {
      setError(
        `勤務時間は営業時間（${referenceBiz.start}〜${referenceBiz.end}）の範囲で指定してください。`,
      )
      return false
    }
    if (weekdayMask.size === 0) {
      setError("対象曜日を1つ以上選んでください。")
      return false
    }
    if (reservationsFetchFailed) {
      setError("予約一覧を取得できなかったため、一括登録できません。")
      return false
    }
    if (reservationsLoading) {
      setError("予約情報を読み込み中です。しばらく待ってから再度お試しください。")
      return false
    }
    if (plan.createCount + plan.updateCount === 0) {
      setError("登録できる日がありません。曜日・定休日・予約の状態を確認してください。")
      return false
    }
    setError(null)
    return true
  }, [
    selectedStaff,
    plan,
    settingsLoading,
    settingsError,
    end,
    start,
    slot,
    referenceBiz,
    weekdayMask,
    reservationsFetchFailed,
    reservationsLoading,
  ])

  const handleRequestConfirm = () => {
    if (!validateBeforeConfirm()) return
    setConfirmError(null)
    setConfirmOpen(true)
  }

  const handleApply = useCallback(async () => {
    if (!selectedStaff || !plan) return

    setSaving(true)
    setConfirmError(null)
    try {
      const { applied, failed } = await applyBulkMonthPlan(
        selectedStaff.id,
        plan,
        apiShiftRows[selectedStaff.id] ?? {},
      )
      for (const a of plan.actions) {
        if (a.type === "create" || a.type === "update") {
          setOverride(selectedStaff.id, a.dateKey, null)
        }
      }
      const msg =
        failed > 0
          ? `${applied}日分を登録しました。${failed}日分は失敗しました。`
          : `${applied}日分のシフトを登録しました（新規 ${plan.createCount}・更新 ${plan.updateCount}）。`
      setResultMessage(msg)
      setConfirmOpen(false)
      onApplied()
    } catch {
      setConfirmError("一括登録に失敗しました。通信またはサーバーを確認してください。")
    } finally {
      setSaving(false)
    }
  }, [selectedStaff, plan, apiShiftRows, setOverride, onApplied])

  const showStaffPicker = editableStaff.length > 1
  const applyDisabled =
    saving ||
    settingsLoading ||
    settingsError ||
    !selectedStaff ||
    reservationsLoading ||
    reservationsFetchFailed ||
    weekdayMask.size === 0

  const weekdaySummary = WEEKDAY_LABELS.filter((_, i) => weekdayMask.has(i)).join("・")

  if (editableStaff.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        編集できるスタッフがいません。
      </p>
    )
  }

  return (
    <>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {monthLabel}の営業日（当日以降）に、同じ勤務時間のシフトをまとめて登録します。チェックした曜日のみ上書きし、未チェックの曜日はスキップします。過去日・定休日・休業曜日・予約と重なる日もスキップします。
        </p>

        {showStaffPicker ? (
          <div className="space-y-1.5">
            <Label htmlFor="bulk-staff">スタッフ</Label>
            <select
              id="bulk-staff"
              className={cn(selectClassName, "w-full max-w-xs min-w-0")}
              value={staffId}
              disabled={saving}
              onChange={(e) => {
                setStaffId(e.target.value)
                setResultMessage(null)
              }}
            >
              {editableStaff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        ) : selectedStaff ? (
          <p className="text-sm">
            <span className="text-muted-foreground">スタッフ：</span>
            {selectedStaff.name}
          </p>
        ) : null}

        <div className="max-w-md space-y-1">
          <p className="text-xs text-muted-foreground">
            営業時間（参考）: {referenceBiz.start} 〜 {referenceBiz.end}
          </p>
          <ShiftTimeRangeFields
            start={start}
            end={end}
            onStartChange={(v) => {
              setStart(v)
              clearResultOnTimeChange()
            }}
            onEndChange={(v) => {
              setEnd(v)
              clearResultOnTimeChange()
            }}
            businessWindow={referenceBiz}
            disabled={saving || settingsLoading || settingsError}
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">対象曜日</legend>
          <div className="flex flex-wrap gap-3">
            {WEEKDAY_LABELS.map((label, dow) => {
              const isClosedWeekday = closedWeekdays.has(dow)
              return (
                <label
                  key={label}
                  className={cn(
                    "flex items-center gap-1.5 text-sm",
                    isClosedWeekday ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                  )}
                  title={isClosedWeekday ? "休業日のため選択できません" : undefined}
                >
                  <input
                    type="checkbox"
                    className="size-4 rounded border-border"
                    checked={!isClosedWeekday && weekdayMask.has(dow)}
                    disabled={saving || isClosedWeekday}
                    onChange={() => toggleWeekday(dow)}
                  />
                  {label}
                  {isClosedWeekday ? (
                    <span className="text-xs text-muted-foreground">（休業）</span>
                  ) : null}
                </label>
              )
            })}
          </div>
        </fieldset>

        {plan ? (
          <p className="max-w-lg rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            登録予定：
            <span className="font-medium text-foreground">
              {plan.createCount + plan.updateCount}
            </span>
            日（新規 {plan.createCount}・更新 {plan.updateCount}）
            {plan.skipCount > 0 ? <>／スキップ {plan.skipCount} 日</> : null}
          </p>
        ) : null}

        {reservationsFetchFailed ? (
          <p className="text-xs text-destructive">予約一覧の取得に失敗しています。</p>
        ) : reservationsLoading ? (
          <p className="text-xs text-muted-foreground">予約情報を読み込み中…</p>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {resultMessage ? (
          <p className="text-sm text-green-800 dark:text-green-300">{resultMessage}</p>
        ) : null}

        <div>
          <Button type="button" disabled={applyDisabled} onClick={handleRequestConfirm}>
            一括登録
          </Button>
        </div>
      </div>

      <ShiftRegisterConfirmDialog
        open={confirmOpen}
        saving={saving}
        error={confirmError}
        summary={
          <dl className="space-y-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
            <div className="flex gap-2">
              <dt className="shrink-0 text-muted-foreground">対象月</dt>
              <dd>{monthLabel}</dd>
            </div>
            {selectedStaff ? (
              <div className="flex gap-2">
                <dt className="shrink-0 text-muted-foreground">スタッフ</dt>
                <dd>{selectedStaff.name}</dd>
              </div>
            ) : null}
            <div className="flex gap-2">
              <dt className="shrink-0 text-muted-foreground">勤務時間</dt>
              <dd>
                {slot.start} 〜 {slot.end}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 text-muted-foreground">曜日</dt>
              <dd>{weekdaySummary || "—"}</dd>
            </div>
            {plan ? (
              <div className="flex gap-2">
                <dt className="shrink-0 text-muted-foreground">登録日数</dt>
                <dd>
                  {plan.createCount + plan.updateCount}日（新規 {plan.createCount}・更新{" "}
                  {plan.updateCount}）
                </dd>
              </div>
            ) : null}
          </dl>
        }
        onCancel={() => !saving && setConfirmOpen(false)}
        onConfirm={() => void handleApply()}
      />
    </>
  )
}
