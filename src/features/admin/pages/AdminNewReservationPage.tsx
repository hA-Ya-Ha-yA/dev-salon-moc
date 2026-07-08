import { useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ROUTES } from "@/constants/routes"
import {
  fetchAdminBookingRules,
  fetchAdminSettings,
  type BusinessHoursItem,
} from "@/features/admin/api/adminSettingsApi"
import { fetchAdminMenus, filterBookableMenus } from "@/features/admin/api/menusApi"
import { fetchAdminReservations } from "@/features/admin/api/reservationsApi"
import {
  fetchTrainerShifts,
  groupTrainerShiftRowsByDate,
} from "@/features/admin/api/trainerShiftsApi"
import { useStaff } from "@/features/admin/hooks/useStaff"
import {
  computeNewReservationStaffEligibility,
  type NewReservationStaffBlockReason,
} from "@/features/admin/lib/adminNewReservationStaffEligibility"
import {
  DEFAULT_ADMIN_NEW_RESERVATION_SLOT_MINUTES,
  defaultAdminNewReservationSlot,
  isAdminNewReservationStartSlot,
  snapAdminNewReservationSlot,
} from "@/features/admin/lib/adminNewReservationTimeSlot"
import {
  ADMIN_CALENDAR_TIME_ZONE,
  addMinutesToIso,
  combineDateAndTimeToAdminTzIso,
  formatTimeInAdminCalendarTz,
  getDateKeyInTimeZone,
  getIsoDateKeyInTimeZone,
} from "@/features/admin/lib/calendarUtils"
import type { AdminNewReservationDraft } from "@/features/admin/types/adminNewReservation"
import {
  getBookingNotBeforeIsoFromState,
  isAdminNewReservationDraft,
} from "@/features/admin/types/adminNewReservation"

function isValidEmail(s: string): boolean {
  const t = s.trim()
  if (!t) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)
}

/** `ReservationDetailCard` の assignee オプションと同じ文言 */
function newReservationStaffOptionTitle(
  reason: NewReservationStaffBlockReason | undefined,
): string | undefined {
  if (reason === "overlap") return "この時間帯にはすでにほかの確定予約があります"
  if (reason === "shift") return "この日の予約時間帯にシフトが登録されていません"
  return undefined
}

function newReservationStaffOptionSuffix(
  reason: NewReservationStaffBlockReason | undefined,
): string {
  if (reason === "overlap") return "（選択不可・予約あり）"
  if (reason === "shift") return "（選択不可・シフトなし）"
  return "（選択不可）"
}

/** 時・分の文字列から `HH:mm` を組み立てる（どちらか空なら null） */
function tryBuildTimeHm(hourStr: string, minuteStr: string): string | null {
  const hs = hourStr.trim()
  const ms = minuteStr.trim()
  if (hs === "" || ms === "") return null
  const hNum = Number(hs)
  const mNum = Number(ms)
  if (!Number.isFinite(hNum) || !Number.isFinite(mNum)) return null
  if (hNum < 0 || hNum > 23 || mNum < 0 || mNum > 59) return null
  return `${String(hNum).padStart(2, "0")}:${String(mNum).padStart(2, "0")}`
}

function splitTimeHm(timeHm: string): { hour: string; minute: string } {
  const m = /^(\d{2}):(\d{2})$/.exec(timeHm.trim())
  if (!m) return { hour: "", minute: "" }
  return { hour: String(Number(m[1])), minute: m[2] }
}

function filterDigitsMax2(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 2)
}

export function AdminNewReservationPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { staffList, loading: staffLoading } = useStaff()

  const bookingNotBeforeIso = useMemo(
    () => getBookingNotBeforeIsoFromState(location.state),
    [location.state],
  )

  const minDateYmd = useMemo(
    () => getDateKeyInTimeZone(new Date(), ADMIN_CALENDAR_TIME_ZONE),
    [],
  )

  const [menus, setMenus] = useState<Awaited<ReturnType<typeof fetchAdminMenus>>>([])
  const [businessHoursItems, setBusinessHoursItems] = useState<BusinessHoursItem[]>([])
  const [holidayDateKeys, setHolidayDateKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const [slotIncrementMinutes, setSlotIncrementMinutes] = useState(
    DEFAULT_ADMIN_NEW_RESERVATION_SLOT_MINUTES,
  )
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [settingsError, setSettingsError] = useState(false)
  const [menusLoading, setMenusLoading] = useState(true)
  const [menusError, setMenusError] = useState(false)

  const initialSlot = useMemo(() => {
    const draft = isAdminNewReservationDraft(location.state) ? location.state : null
    if (draft) {
      return { dateYmd: draft.dateYmd, timeHm: draft.timeHm }
    }
    return {
      dateYmd: minDateYmd,
      timeHm: "10:00",
    }
  }, [location.state, minDateYmd])

  const initialDraft = useMemo(
    () => (isAdminNewReservationDraft(location.state) ? location.state : null),
    [location.state],
  )

  const [menuId, setMenuId] = useState(() => initialDraft?.menuId ?? "")
  const [dateYmd, setDateYmd] = useState(() => initialSlot.dateYmd)
  const [hourStr, setHourStr] = useState(() => splitTimeHm(initialSlot.timeHm).hour)
  const [minuteStr, setMinuteStr] = useState(() => splitTimeHm(initialSlot.timeHm).minute)
  const [trainerId, setTrainerId] = useState(() => initialDraft?.trainerId ?? "")
  const [customerName, setCustomerName] = useState(() => initialDraft?.customerName ?? "")
  const [customerEmail, setCustomerEmail] = useState(() => initialDraft?.customerEmail ?? "")
  const [customerPhone, setCustomerPhone] = useState(() => initialDraft?.customerPhone ?? "")
  const [notes, setNotes] = useState(() => initialDraft?.notes ?? "")
  const [formError, setFormError] = useState("")

  const [eligibleByStaffId, setEligibleByStaffId] = useState<Record<string, boolean>>({})
  const [blockReasonByStaffId, setBlockReasonByStaffId] = useState<
    Record<string, NewReservationStaffBlockReason>
  >({})
  const [staffEligibilityLoading, setStaffEligibilityLoading] = useState(false)
  const [staffEligibilityError, setStaffEligibilityError] = useState(false)

  const selectedMenu = useMemo(
    () => menus.find((m) => m.menu_id === menuId),
    [menus, menuId],
  )
  const durationMinutes = selectedMenu?.duration_minutes

  const timeHm = useMemo(() => tryBuildTimeHm(hourStr, minuteStr), [hourStr, minuteStr])

  const reservationTimeContextReady =
    !settingsLoading && !settingsError && businessHoursItems.length > 0

  /**
   * 予約ルール（刻み）・営業時間に沿う有効枠へ日付・時刻を補正する。
   * 時・分の入力中は呼ばない（キー入力のたびに走ると「1」が「08」などに化けるため）。
   */
  function commitSlotToValidRules(
    date: string,
    hour: string,
    minute: string,
  ): void {
    if (!reservationTimeContextReady) return
    const hm = tryBuildTimeHm(hour, minute)
    if (!hm) return
    const now = new Date()
    const snapped = snapAdminNewReservationSlot(
      date,
      hm,
      businessHoursItems,
      holidayDateKeys,
      slotIncrementMinutes,
      now,
      durationMinutes,
    )
    if (!snapped) return
    setDateYmd(snapped.dateYmd)
    const { hour: h, minute: m } = splitTimeHm(snapped.timeHm)
    setHourStr(h)
    setMinuteStr(m)
  }

  /** 開始日の変更時、または設定読込後に時刻を有効枠へ補正 */
  useEffect(() => {
    if (!reservationTimeContextReady) return
    commitSlotToValidRules(dateYmd, hourStr, minuteStr)
    // hourStr / minuteStr は依存に含めない（入力中に再実行しない）
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dateYmd・設定の変更時のみ
  }, [dateYmd, reservationTimeContextReady, slotIncrementMinutes, durationMinutes])

  const startAtIso = useMemo(() => {
    if (!menuId.trim() || !dateYmd || !timeHm || !reservationTimeContextReady) return null
    if (
      !isAdminNewReservationStartSlot(
        dateYmd,
        timeHm,
        businessHoursItems,
        holidayDateKeys,
        slotIncrementMinutes,
        new Date(),
        durationMinutes,
      )
    ) {
      return null
    }
    return combineDateAndTimeToAdminTzIso(dateYmd, timeHm)
  }, [
    menuId,
    dateYmd,
    timeHm,
    reservationTimeContextReady,
    businessHoursItems,
    holidayDateKeys,
    slotIncrementMinutes,
    durationMinutes,
  ])

  const endAtIso = useMemo(() => {
    if (!startAtIso || durationMinutes === undefined || durationMinutes <= 0) return null
    return addMinutesToIso(startAtIso, durationMinutes)
  }, [startAtIso, durationMinutes])

  const canComputeWindow = Boolean(startAtIso && endAtIso)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setMenusLoading(true)
      setMenusError(false)
      try {
        const list = await fetchAdminMenus()
        if (cancelled) return
        setMenus(filterBookableMenus(list))
      } catch (e) {
        if (cancelled) return
        if (e instanceof Error && e.message === "UNAUTHORIZED") {
          navigate(ROUTES.backofficeLogin, { replace: true })
          return
        }
        setMenusError(true)
        setMenus([])
      } finally {
        if (!cancelled) setMenusLoading(false)
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
          return
        }
        setSettingsError(true)
        setBusinessHoursItems([])
        setHolidayDateKeys(new Set())
      } finally {
        if (!cancelled) setSettingsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [navigate])

  useEffect(() => {
    if (menusLoading || menusError) return
    if (!menuId.trim()) return
    if (!menus.some((m) => m.menu_id === menuId)) {
      setMenuId("")
    }
  }, [menus, menusLoading, menusError, menuId])

  useEffect(() => {
    if (settingsLoading || settingsError || businessHoursItems.length === 0) return

    const st = location.state
    const draft = isAdminNewReservationDraft(st) ? st : null
    const now = new Date()

    if (draft) {
      const snapped = snapAdminNewReservationSlot(
        draft.dateYmd,
        draft.timeHm,
        businessHoursItems,
        holidayDateKeys,
        slotIncrementMinutes,
        now,
        draft.durationMinutes,
      )
      setMenuId(draft.menuId)
      if (snapped) {
        setDateYmd(snapped.dateYmd)
        const parts = splitTimeHm(snapped.timeHm)
        setHourStr(parts.hour)
        setMinuteStr(parts.minute)
      }
      setTrainerId(draft.trainerId)
      setCustomerName(draft.customerName)
      setCustomerEmail(draft.customerEmail)
      setCustomerPhone(draft.customerPhone ?? "")
      setNotes(draft.notes ?? "")
      return
    }

    const slot = defaultAdminNewReservationSlot(
      businessHoursItems,
      holidayDateKeys,
      slotIncrementMinutes,
      now,
    )
    if (slot) {
      setDateYmd(slot.dateYmd)
      const slotParts = splitTimeHm(slot.timeHm)
      setHourStr(slotParts.hour)
      setMinuteStr(slotParts.minute)
    }
    setMenuId("")
    setTrainerId("")
    setCustomerName("")
    setCustomerEmail("")
    setCustomerPhone("")
    setNotes("")
  }, [
    location.state,
    settingsLoading,
    settingsError,
    businessHoursItems,
    holidayDateKeys,
    slotIncrementMinutes,
  ])

  useEffect(() => {
    if (!staffList.length || staffLoading || !startAtIso || !endAtIso) {
      setEligibleByStaffId({})
      setBlockReasonByStaffId({})
      setStaffEligibilityLoading(false)
      setStaffEligibilityError(false)
      return
    }
    let cancelled = false
    void (async () => {
      setStaffEligibilityLoading(true)
      setStaffEligibilityError(false)
      try {
        const dateKey = getIsoDateKeyInTimeZone(startAtIso, ADMIN_CALENDAR_TIME_ZONE)
        const [resList, shiftResults] = await Promise.all([
          fetchAdminReservations(staffList, {
            viewMode: "day",
            anchorDate: new Date(`${dateKey}T12:00:00+09:00`),
            dateKeyOverride: dateKey,
          }),
          Promise.all(
            staffList.map((s) =>
              fetchTrainerShifts(s.id, { dateFrom: dateKey, dateTo: dateKey }),
            ),
          ),
        ])
        if (cancelled) return
        const next: Record<string, boolean> = {}
        const reasons: Record<string, NewReservationStaffBlockReason> = {}
        staffList.forEach((s, i) => {
          const byDate = groupTrainerShiftRowsByDate(shiftResults[i], s.id)
          const dayRows = byDate[dateKey] ?? []
          const { ok, reason } = computeNewReservationStaffEligibility(
            s.id,
            startAtIso,
            endAtIso,
            resList,
            dayRows,
          )
          next[s.id] = ok
          if (!ok && reason) reasons[s.id] = reason
        })
        setEligibleByStaffId(next)
        setBlockReasonByStaffId(reasons)
      } catch (e) {
        if (cancelled) return
        if (e instanceof Error && e.message === "UNAUTHORIZED") {
          navigate(ROUTES.backofficeLogin, { replace: true })
          return
        }
        setStaffEligibilityError(true)
        setEligibleByStaffId({})
        setBlockReasonByStaffId({})
      } finally {
        if (!cancelled) setStaffEligibilityLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [startAtIso, endAtIso, staffList, staffLoading, navigate])

  useEffect(() => {
    if (!trainerId) return
    if (staffEligibilityLoading) return
    if (eligibleByStaffId[trainerId] !== true) {
      setTrainerId("")
    }
  }, [eligibleByStaffId, trainerId, staffEligibilityLoading])

  function applyDateChange(nextDateYmd: string) {
    setDateYmd(nextDateYmd)
  }

  function handleHourDigitsInput(raw: string) {
    const d = filterDigitsMax2(raw)
    let next = d
    if (d.length === 2) {
      const n = Number(d)
      if (n > 23) next = "23"
    }
    setHourStr(next)
  }

  function handleMinuteDigitsInput(raw: string) {
    const d = filterDigitsMax2(raw)
    let next = d
    if (d.length === 2) {
      const n = Number(d)
      if (n > 59) next = "59"
    }
    setMinuteStr(next)
  }

  function handleHourBlur() {
    commitSlotToValidRules(dateYmd, hourStr, minuteStr)
  }

  function handleMinuteBlur() {
    const d = minuteStr.replace(/\D/g, "")
    let nextMin = minuteStr
    if (d !== "") {
      const n = Math.min(59, Math.max(0, Number(d)))
      if (Number.isFinite(n)) nextMin = String(n).padStart(2, "0")
    } else {
      nextMin = ""
    }
    setMinuteStr(nextMin)
    commitSlotToValidRules(dateYmd, hourStr, nextMin)
  }

  function handleConfirmClick() {
    setFormError("")
    if (!menuId.trim()) {
      setFormError("メニューを選択してください。")
      return
    }
    if (durationMinutes === undefined || durationMinutes <= 0) {
      setFormError("メニューに所要時間（分）が含まれていません。API のメニュー定義を確認してください。")
      return
    }
    if (!reservationTimeContextReady) {
      setFormError("営業時間・予約ルールを読み込み中です。しばらく待ってから再度お試しください。")
      return
    }
    const hm = tryBuildTimeHm(hourStr, minuteStr)
    if (!hm) {
      setFormError("日付と時刻を入力してください。")
      return
    }
    const now = new Date()
    const ensuredSlot = snapAdminNewReservationSlot(
      dateYmd,
      hm,
      businessHoursItems,
      holidayDateKeys,
      slotIncrementMinutes,
      now,
      durationMinutes,
    )
    if (
      !ensuredSlot ||
      !isAdminNewReservationStartSlot(
        ensuredSlot.dateYmd,
        ensuredSlot.timeHm,
        businessHoursItems,
        holidayDateKeys,
        slotIncrementMinutes,
        now,
        durationMinutes,
      )
    ) {
      setFormError(
        `開始時刻は営業時間内かつ ${slotIncrementMinutes} 分刻みで、現在時刻より後の時刻を選んでください。`,
      )
      return
    }
    const finalDateYmd = ensuredSlot.dateYmd
    const finalTimeHm = ensuredSlot.timeHm
    if (!staffLoading && staffList.length > 0) {
      if (staffEligibilityLoading) {
        setFormError("担当者の可否を確認しています。しばらく待ってから再度お試しください。")
        return
      }
      if (staffEligibilityError) {
        setFormError("予約一覧またはシフトの取得に失敗しました。通信を確認してください。")
        return
      }
      if (!trainerId.trim()) {
        setFormError("担当者（スタッフ）を選択してください。")
        return
      }
      if (eligibleByStaffId[trainerId] !== true) {
        setFormError("選択した担当者はこの時間帯に予約できません。別の担当者を選んでください。")
        return
      }
    }
    if (!customerName.trim()) {
      setFormError("顧客名を入力してください。")
      return
    }
    if (!isValidEmail(customerEmail)) {
      setFormError("有効なメールアドレスを入力してください。")
      return
    }
    const menuName = menus.find((m) => m.menu_id === menuId)?.name
    const trainerName = staffList.find((s) => s.id === trainerId)?.name
    const draft: AdminNewReservationDraft = {
      bookingNotBeforeIso,
      menuId: menuId.trim(),
      menuName,
      dateYmd: finalDateYmd,
      timeHm: finalTimeHm,
      durationMinutes,
      trainerId: trainerId.trim(),
      trainerName,
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      customerPhone: customerPhone.trim() || undefined,
      notes: notes.trim() || undefined,
    }
    navigate(ROUTES.adminNewReservationConfirm, { state: draft })
  }

  const confirmDisabled =
    staffLoading ||
    (staffList.length > 0 &&
      (!canComputeWindow ||
        staffEligibilityLoading ||
        staffEligibilityError ||
        !trainerId.trim() ||
        eligibleByStaffId[trainerId] !== true))

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">新規予約（代理登録）</h2>
      </div>

      <Card className="border-border shadow-xs">
        <CardHeader>
          <CardTitle className="text-base">予約内容</CardTitle>
          <CardDescription>
            必須: メニュー、開始日時、顧客名、メール。
            {staffList.length > 0 ? " メニュー・開始時刻入力後に担当者を選択、" : null}
            任意: 電話、メモ。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-new-menu">メニュー</Label>
            <select
              id="admin-new-menu"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={menuId}
              disabled={menusLoading || menusError}
              onChange={(e) => {
                setMenuId(e.target.value)
                setTrainerId("")
              }}
            >
              <option value="">選択してください</option>
              {menus.map((m) => (
                <option key={m.menu_id} value={m.menu_id}>
                  {m.name}
                </option>
              ))}
            </select>
            {menusLoading ? (
              <p className="text-xs text-muted-foreground">メニューを読み込み中…</p>
            ) : null}
            {menusError ? (
              <p className="text-xs text-destructive" role="alert">
                メニュー一覧の取得に失敗しました。GET /api/admin/menus を確認してください。
              </p>
            ) : null}
            {!menusLoading && !menusError && menus.length === 0 ? (
              <p className="text-xs text-destructive" role="alert">
                メニューが登録されていません。
              </p>
            ) : null}
            {menuId && durationMinutes === undefined ? (
              <p className="text-xs text-destructive" role="alert">
                このメニューに所要時間（分）が含まれていません。API のレスポンスに duration
                系フィールドがあるか確認してください。
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="admin-new-date">開始日（{ADMIN_CALENDAR_TIME_ZONE}）</Label>
              <Input
                id="admin-new-date"
                type="date"
                min={minDateYmd}
                value={dateYmd}
                onChange={(e) => {
                  applyDateChange(e.target.value)
                  setTrainerId("")
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-new-hour">開始時刻</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id="admin-new-hour"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  className="w-14 tabular-nums"
                  maxLength={2}
                  value={hourStr}
                  placeholder="0-23"
                  onChange={(e) => {
                    handleHourDigitsInput(e.target.value)
                    setTrainerId("")
                  }}
                  onBlur={handleHourBlur}
                  aria-label="時（0〜23、数字のみ）"
                />
                <span className="select-none text-muted-foreground" aria-hidden>
                  :
                </span>
                <Input
                  id="admin-new-minute"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  className="w-14 tabular-nums"
                  maxLength={2}
                  value={minuteStr}
                  placeholder="00-59"
                  onChange={(e) => {
                    handleMinuteDigitsInput(e.target.value)
                    setTrainerId("")
                  }}
                  onBlur={handleMinuteBlur}
                  aria-label="分（00〜59、数字のみ）"
                />
              </div>
              {settingsLoading ? (
                <p className="text-xs text-muted-foreground">営業時間・予約ルールを読み込み中…</p>
              ) : null}
              {settingsError ? (
                <p className="text-xs text-destructive" role="alert">
                  営業時間または予約ルールの取得に失敗しました。
                </p>
              ) : null}
            </div>
          </div>

          {canComputeWindow && endAtIso ? (
            <p className="text-xs text-muted-foreground">
              終了予定: {formatTimeInAdminCalendarTz(endAtIso)}（メニュー所要 {durationMinutes} 分）
            </p>
          ) : null}

          {!staffLoading && staffList.length > 0 ? (
            <div className="space-y-2">
              <Label htmlFor="admin-new-trainer">担当者（スタッフ）</Label>
              <select
                id="admin-new-trainer"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                value={trainerId}
                disabled={
                  !canComputeWindow ||
                  durationMinutes === undefined ||
                  staffEligibilityLoading ||
                  staffEligibilityError
                }
                onChange={(e) => setTrainerId(e.target.value)}
              >
                <option value="">
                  {!canComputeWindow || durationMinutes === undefined
                    ? "先にメニューと開始時刻を入力してください"
                    : staffEligibilityLoading
                      ? "担当者を確認しています…"
                      : staffEligibilityError
                        ? "取得に失敗しました"
                        : "選択してください"}
                </option>
                {staffList.map((s) => {
                  const ok = eligibleByStaffId[s.id] === true
                  const reason = blockReasonByStaffId[s.id]
                  return (
                    <option
                      key={s.id}
                      value={s.id}
                      disabled={!ok}
                      title={!ok ? newReservationStaffOptionTitle(reason) : undefined}
                    >
                      {s.name}
                      {!ok ? newReservationStaffOptionSuffix(reason) : ""}
                    </option>
                  )
                })}
              </select>
              {staffEligibilityLoading ? (
                <p className="text-xs text-muted-foreground">
                  予約一覧とシフトを照会しています…
                </p>
              ) : null}
              {staffEligibilityError ? (
                <p className="text-xs text-destructive" role="alert">
                  予約またはシフト情報の取得に失敗しました。
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="admin-new-cname">顧客名</Label>
            <Input
              id="admin-new-cname"
              autoComplete="name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="山田 太郎"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-new-email">顧客メールアドレス</Label>
            <Input
              id="admin-new-email"
              type="email"
              autoComplete="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="example@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-new-phone">顧客電話番号（任意）</Label>
            <Input
              id="admin-new-phone"
              type="tel"
              autoComplete="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="090-1234-5678"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-new-notes">メモ（任意）</Label>
            <textarea
              id="admin-new-notes"
              className="min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="スタッフ向けメモ"
            />
          </div>

          {formError ? (
            <p className="text-sm text-destructive" role="alert">
              {formError}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              type="button"
              className="rounded-md"
              disabled={confirmDisabled}
              onClick={() => void handleConfirmClick()}
            >
              確認
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
