import { Plus, Trash2 } from "lucide-react"
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react"
import { useLocation, useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ROUTES } from "@/constants/routes"
import {
  postHoliday,
  putBusinessHours,
  type HolidayCreated,
} from "@/features/admin/api/adminSettingsApi"
import { postAdminLogout } from "@/features/auth/api/adminLoginApi"
import {
  canAccessSalonSettingsStep,
  carryAdminSalonNavState,
  isAdminSalonSettingsFlow,
  resolveAdminSalonReturnTo,
  type SalonSettingsFlowNavState,
} from "@/features/auth/lib/salonSettingsNavState"
import { clearSignupVerification } from "@/features/auth/lib/signupVerification"

const STORAGE_KEY = "backoffice_initial_setup_business_hours_v1"
const INITIAL_SETUP_DRAFT_KEY = "backoffice_initial_setup_draft_v1"
const BACK_NAV_BLOCKED_MESSAGE =
  "ブラウザの戻るボタンはご利用いただけません。セッション整合のため、この画面では履歴による前のページへの戻り移動を行っていません。"

/** API と同じ並び（0=月…6=日）。 */
const DAY_OF_WEEK = [
  { value: 0, label: "月曜日" },
  { value: 1, label: "火曜日" },
  { value: 2, label: "水曜日" },
  { value: 3, label: "木曜日" },
  { value: 4, label: "金曜日" },
  { value: 5, label: "土曜日" },
  { value: 6, label: "日曜日" },
] as const

type BusinessHourRow = {
  /** 0=月…6=日 */
  day_of_week: number
  /** "HH:mm" */
  start_time: string
  /** "HH:mm" */
  end_time: string
  is_closed: boolean
}

type HolidayInputRow = {
  /** クライアント側の一意キー（DB の id ではない） */
  tempId: string
  /** MM/DD（空文字 = 未入力） */
  date: string
  /** 休業理由（任意） */
  description: string
}

type BusinessHoursDraft = {
  email: string
  rows: BusinessHourRow[]
  holidays: { date: string; description: string }[]
}

function genTempId(): string {
  const c = (
    typeof crypto !== "undefined" ? crypto : undefined
  ) as Crypto | undefined
  if (c?.randomUUID) return c.randomUUID()
  return `tmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeHolidayMonthDayInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}/${digits.slice(2)}`
}

function holidayMonthDayFromStoredDate(value: string): string {
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed.slice(5).replace("-", "/")
  if (/^\d{2}-\d{2}$/.test(trimmed)) return trimmed.replace("-", "/")
  return normalizeHolidayMonthDayInput(trimmed)
}

function isValidHolidayMonthDay(s: string): boolean {
  const m = /^(\d{2})\/(\d{2})$/.exec(s)
  if (!m) return false
  const month = Number(m[1])
  const day = Number(m[2])
  if (month < 1 || month > 12 || day < 1 || day > 31) return false
  const year = 2000
  const d = new Date(year, month - 1, day)
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day
}

function isValidDateParts(year: number, month: number, day: number): boolean {
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

function holidayMonthDayToNextISODate(monthDay: string): string {
  const [monthRaw, dayRaw] = monthDay.split("/")
  const month = Number(monthRaw)
  const day = Number(dayRaw)
  const today = new Date()
  const todayAtMidnight = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  )

  for (let year = today.getFullYear(); ; year += 1) {
    if (!isValidDateParts(year, month, day)) continue
    const candidate = new Date(year, month - 1, day)
    if (candidate >= todayAtMidnight) {
      return `${year}-${monthRaw}-${dayRaw}`
    }
  }
}

function buildSaveSummary(
  rows: BusinessHourRow[],
  cleanedHolidays: { date: string; description: string }[],
): string[] {
  const lines: string[] = []
  for (const r of rows) {
    const label =
      DAY_OF_WEEK.find((d) => d.value === r.day_of_week)?.label ?? "曜日"
    if (r.is_closed) {
      lines.push(`${label}: 定休日`)
    } else {
      lines.push(`${label}: ${r.start_time} 〜 ${r.end_time}`)
    }
  }
  if (cleanedHolidays.length === 0) {
    lines.push("休業日: なし")
  } else {
    for (const h of cleanedHolidays) {
      const desc = h.description ? `（${h.description}）` : ""
      lines.push(`休業日: ${h.date}${desc}`)
    }
  }
  return lines
}

function defaultRows(): BusinessHourRow[] {
  return DAY_OF_WEEK.map(({ value }) => ({
    day_of_week: value,
    start_time: "10:00",
    end_time: "20:00",
    is_closed: value === 6, // 既定: 日曜定休
  }))
}

function loadDraft(): BusinessHoursDraft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<BusinessHoursDraft> | null
    if (!parsed || !Array.isArray(parsed.rows)) return null
    return {
      email: typeof parsed.email === "string" ? parsed.email : "",
      rows: parsed.rows
        .filter((r): r is BusinessHourRow =>
          Boolean(
            r &&
              typeof r === "object" &&
              typeof r.day_of_week === "number" &&
              typeof r.start_time === "string" &&
              typeof r.end_time === "string",
          ),
        )
        .map((r) => ({
          day_of_week: r.day_of_week,
          start_time: r.start_time,
          end_time: r.end_time,
          is_closed: Boolean(r.is_closed),
        })),
      holidays: Array.isArray(parsed.holidays)
        ? parsed.holidays
            .filter(
              (h): h is { date: string; description: string } =>
                Boolean(
                  h &&
                    typeof h === "object" &&
                    typeof (h as { date?: unknown }).date === "string",
                ),
            )
            .map((h) => ({
              date: h.date,
              description:
                typeof h.description === "string" ? h.description : "",
            }))
        : [],
    }
  } catch {
    return null
  }
}

function timeToMinutes(t: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim())
  if (!m) return -1
  const h = Number(m[1])
  const min = Number(m[2])
  if (!Number.isFinite(h) || !Number.isFinite(min)) return -1
  if (h < 0 || h > 23 || min < 0 || min > 59) return -1
  return h * 60 + min
}

function isValidHHmm(t: string): boolean {
  return timeToMinutes(t) >= 0
}

export function BackofficeSetupBusinessHoursPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const navState = location.state as SalonSettingsFlowNavState | null
  const fromInitialSetup = Boolean(navState?.fromInitialSetup)
  const fromAdminSalonSettings = isAdminSalonSettingsFlow(navState)
  const stateEmail = typeof navState?.email === "string" ? navState.email : ""

  const stored = useMemo(() => loadDraft(), [])
  const initialEmail = stateEmail || stored?.email || ""
  const initialRows = stored?.rows?.length ? stored.rows : defaultRows()

  const [rows, setRows] = useState<BusinessHourRow[]>(() =>
    DAY_OF_WEEK.map(({ value }) => {
      const found = initialRows.find((r) => r.day_of_week === value)
      return (
        found ?? {
          day_of_week: value,
          start_time: "10:00",
          end_time: "20:00",
          is_closed: value === 6,
        }
      )
    }),
  )
  const [holidays, setHolidays] = useState<HolidayInputRow[]>(() => {
    const persisted = stored?.holidays ?? []
    return persisted.map((h) => ({
      tempId: genTempId(),
      date: holidayMonthDayFromStoredDate(h.date),
      description: h.description ?? "",
    }))
  })
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [showSaveConfirm, setShowSaveConfirm] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [backNavigateNotice, setBackNavigateNotice] = useState("")
  const restoreStateRef = useRef<unknown>(null)
  restoreStateRef.current = location.state

  // 直接アクセス（state も localStorage の前ステップ完了印も無い）の場合は前ステップへ
  useEffect(() => {
    if (!canAccessSalonSettingsStep(navState)) {
      navigate(ROUTES.backofficeInitialSetup, { replace: true })
    }
  }, [navState, navigate])

  // ブラウザ戻る抑止（capture phase で React Router より先に握りつぶす）
  useLayoutEffect(() => {
    if (!canAccessSalonSettingsStep(navState)) return
    function onPopState(e: PopStateEvent) {
      e.stopImmediatePropagation()
      setBackNavigateNotice(BACK_NAV_BLOCKED_MESSAGE)
      navigate(ROUTES.backofficeSetupBusinessHours, {
        replace: true,
        state: restoreStateRef.current ?? {
          fromInitialSetup,
          email: initialEmail,
        },
      })
    }
    window.addEventListener("popstate", onPopState, { capture: true })
    return () =>
      window.removeEventListener("popstate", onPopState, { capture: true })
  }, [navState, fromInitialSetup, initialEmail, navigate])

  function updateRow(value: number, patch: Partial<BusinessHourRow>) {
    setRows((prev) =>
      prev.map((r) => (r.day_of_week === value ? { ...r, ...patch } : r)),
    )
    setError("")
  }

  function addHolidayRow() {
    setHolidays((prev) => [
      ...prev,
      { tempId: genTempId(), date: "", description: "" },
    ])
    setError("")
  }

  function updateHolidayRow(tempId: string, patch: Partial<HolidayInputRow>) {
    setHolidays((prev) =>
      prev.map((h) => (h.tempId === tempId ? { ...h, ...patch } : h)),
    )
    setError("")
  }

  function removeHolidayRow(tempId: string) {
    setHolidays((prev) => prev.filter((h) => h.tempId !== tempId))
    setError("")
  }

  function validateForm(): { cleanedHolidays: { date: string; description: string }[] } | null {
    // --- 営業時間バリデーション ---
    for (const r of rows) {
      const label =
        DAY_OF_WEEK.find((d) => d.value === r.day_of_week)?.label ?? "曜日"
      if (r.is_closed) continue
      if (!isValidHHmm(r.start_time) || !isValidHHmm(r.end_time)) {
        setError(`${label}の時刻は HH:mm 形式で入力してください。`)
        return null
      }
      if (timeToMinutes(r.end_time) <= timeToMinutes(r.start_time)) {
        setError(`${label}の終了時刻は開始時刻より後に設定してください。`)
        return null
      }
    }

    if (rows.every((r) => r.is_closed)) {
      setError(
        "すべての曜日を定休日にすることはできません。少なくとも1日は営業日にしてください。",
      )
      return null
    }

    // --- 休業日バリデーション（任意・空行はスキップ） ---
    const cleanedHolidays = holidays
      .map((h) => ({
        date: holidayMonthDayFromStoredDate(h.date),
        description: h.description.trim(),
      }))
      .filter((h) => h.date.length > 0)

    for (const h of cleanedHolidays) {
      if (!isValidHolidayMonthDay(h.date)) {
        setError(`休業日「${h.date}」の日付形式が正しくありません（MM/DD）。`)
        return null
      }
      if (h.description.length > 200) {
        setError("休業理由は200文字以内で入力してください。")
        return null
      }
    }
    const dateSet = new Set<string>()
    for (const h of cleanedHolidays) {
      if (dateSet.has(h.date)) {
        setError(`休業日「${h.date}」が重複しています。`)
        return null
      }
      dateSet.add(h.date)
    }

    return { cleanedHolidays }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!validateForm()) return
    setError("")
    setShowSaveConfirm(true)
  }

  async function confirmSave() {
    const validated = validateForm()
    if (!validated) {
      setShowSaveConfirm(false)
      return
    }
    const { cleanedHolidays } = validated

    setSaving(true)
    try {
      // 1) PUT /api/admin/settings/business-hours
      const bhResult = await putBusinessHours(
        rows.map((r) => ({
          day_of_week: r.day_of_week,
          start_time: r.start_time,
          end_time: r.end_time,
          is_closed: r.is_closed,
        })),
      )
      if (bhResult.kind === "unauthorized") {
        setError(
          "認証セッションが切れています。お手数ですがログイン画面から再度ログインしてください。",
        )
        return
      }
      if (bhResult.kind !== "ok") {
        setError(
          bhResult.message
            ? `営業時間の保存に失敗しました（${bhResult.message}）。`
            : "営業時間の保存に失敗しました。時間をおいて再度お試しください。",
        )
        return
      }

      // 2) POST /api/admin/settings/holidays （各日付ごとに1回ずつ）
      const created: HolidayCreated[] = []
      for (const h of cleanedHolidays) {
        const apiDate = holidayMonthDayToNextISODate(h.date)
        const r = await postHoliday({
          date: apiDate,
          description: h.description || null,
        })
        if (r.kind === "unauthorized") {
          setError(
            "認証セッションが切れています。お手数ですがログイン画面から再度ログインしてください。",
          )
          return
        }
        if (r.kind !== "ok") {
          setError(
            r.message
              ? `休業日「${h.date}」の保存に失敗しました（${r.message}）。`
              : `休業日「${h.date}」の保存に失敗しました。時間をおいて再度お試しください。`,
          )
          return
        }
        created.push(r.holiday)
      }

      // ローカル下書きを更新（休業日入力欄も保持しておく）
      try {
        const draft: BusinessHoursDraft = {
          email: initialEmail,
          rows,
          holidays: cleanedHolidays,
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
      } catch {
        // ignore storage 失敗
      }

      if (fromAdminSalonSettings) {
        navigate(resolveAdminSalonReturnTo(navState), { replace: true })
        return
      }

      navigate(ROUTES.backofficeSetupBookingRules, {
        replace: true,
        state: carryAdminSalonNavState(navState, {
          fromBusinessHours: true,
          email: initialEmail,
        }),
      })
    } finally {
      setSaving(false)
      setShowSaveConfirm(false)
    }
  }

  const saveSummaryLines = useMemo(() => {
    const cleaned = holidays
      .map((h) => ({
        date: holidayMonthDayFromStoredDate(h.date),
        description: h.description.trim(),
      }))
      .filter((h) => h.date.length > 0)
    return buildSaveSummary(rows, cleaned)
  }, [rows, holidays])

  async function handleConfirmCancel() {
    setShowCancelConfirm(false)
    try {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(INITIAL_SETUP_DRAFT_KEY)
    } catch {
      // ignore
    }
    clearSignupVerification()
    await postAdminLogout()
    navigate(ROUTES.backofficeLogin, { replace: true })
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-8 sm:px-6">
      {backNavigateNotice ? (
        <div
          role="alert"
          className="mb-4 flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between"
        >
          <p>{backNavigateNotice}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 border-amber-300 bg-white"
            onClick={() => setBackNavigateNotice("")}
          >
            閉じる
          </Button>
        </div>
      ) : null}

      <div className="mb-6">
        {!fromAdminSalonSettings ? (
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-400">
            初期設定 - ステップ 2 / 3
          </p>
        ) : null}
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          営業日・営業時間の登録
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {!fromAdminSalonSettings
            ? "各曜日の営業時間・定休日と、個別の休業日（任意）を設定してください。後からも変更できます。"
            : "各曜日の営業時間・定休日と、個別の休業日（任意）を設定してください。"}
        </p>
        {initialEmail ? (
          <p className="mt-2 text-xs text-emerald-700">
            認証済みメールアドレス:{" "}
            <span className="font-mono">{initialEmail}</span>
          </p>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">曜日ごとの営業時間</h2>
          <div className="overflow-hidden rounded-lg border border-border bg-card">
          {rows.map((row, idx) => {
            const label =
              DAY_OF_WEEK.find((d) => d.value === row.day_of_week)?.label ?? ""
            return (
              <div
                key={row.day_of_week}
                className={
                  "grid grid-cols-1 items-center gap-3 px-4 py-3 sm:grid-cols-[5rem_1fr_1fr_8rem]" +
                  (idx > 0 ? " border-t border-border" : "")
                }
              >
                <div className="text-sm font-medium text-foreground">{label}</div>

                <div className="flex items-center gap-2">
                  <Label
                    htmlFor={`start-${row.day_of_week}`}
                    className="sr-only"
                  >
                    {label}の開始時刻
                  </Label>
                  <Input
                    id={`start-${row.day_of_week}`}
                    type="time"
                    value={row.start_time}
                    disabled={row.is_closed}
                    onChange={(e) =>
                      updateRow(row.day_of_week, { start_time: e.target.value })
                    }
                    className="h-9"
                  />
                  <span className="text-xs text-muted-foreground">開始</span>
                </div>

                <div className="flex items-center gap-2">
                  <Label
                    htmlFor={`end-${row.day_of_week}`}
                    className="sr-only"
                  >
                    {label}の終了時刻
                  </Label>
                  <Input
                    id={`end-${row.day_of_week}`}
                    type="time"
                    value={row.end_time}
                    disabled={row.is_closed}
                    onChange={(e) =>
                      updateRow(row.day_of_week, { end_time: e.target.value })
                    }
                    className="h-9"
                  />
                  <span className="text-xs text-muted-foreground">終了</span>
                </div>

                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={row.is_closed}
                    onChange={(e) =>
                      updateRow(row.day_of_week, { is_closed: e.target.checked })
                    }
                    className="size-4 cursor-pointer rounded border-border accent-black"
                  />
                  定休日
                </label>
              </div>
            )
          })}
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex items-end justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-foreground">休業日（任意）</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                個別の休業日（年末年始・臨時休業など）を登録します。曜日定休とは別です。
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addHolidayRow}
              disabled={saving}
            >
              <Plus className="size-4" />
              休業日を追加
            </Button>
          </div>

          {holidays.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-xs text-muted-foreground">
              休業日はまだ登録されていません。必要な場合は「休業日を追加」から登録してください。
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              {holidays.map((h, idx) => (
                <div
                  key={h.tempId}
                  className={
                    "grid grid-cols-1 items-center gap-2 px-4 py-3 sm:grid-cols-[10rem_1fr_auto]" +
                    (idx > 0 ? " border-t border-border" : "")
                  }
                >
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`holiday-date-${h.tempId}`} className="sr-only">
                      休業日 {idx + 1} の日付
                    </Label>
                    <Input
                      id={`holiday-date-${h.tempId}`}
                      type="text"
                      inputMode="numeric"
                      placeholder="例: 12/31"
                      maxLength={5}
                      value={h.date}
                      onChange={(e) =>
                        updateHolidayRow(h.tempId, {
                          date: normalizeHolidayMonthDayInput(e.target.value),
                        })
                      }
                      className="h-9"
                      disabled={saving}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor={`holiday-desc-${h.tempId}`}
                      className="sr-only"
                    >
                      休業日 {idx + 1} の休業理由
                    </Label>
                    <Input
                      id={`holiday-desc-${h.tempId}`}
                      type="text"
                      value={h.description}
                      placeholder="休業理由（例: 年末年始、臨時休業）"
                      maxLength={200}
                      onChange={(e) =>
                        updateHolidayRow(h.tempId, { description: e.target.value })
                      }
                      className="h-9"
                      disabled={saving}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`休業日 ${idx + 1} を削除`}
                    onClick={() => removeHolidayRow(h.tempId)}
                    disabled={saving}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          {!fromAdminSalonSettings ? (
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setShowCancelConfirm(true)}
            >
              キャンセル
            </Button>
          ) : null}
          <Button type="submit" disabled={saving}>
            {saving ? "保存中..." : "登録内容を確認"}
          </Button>
        </div>
      </form>

      {showSaveConfirm ? (
        <SetupSaveConfirmModal
          lines={saveSummaryLines}
          saving={saving}
          onClose={() => !saving && setShowSaveConfirm(false)}
          onConfirm={() => void confirmSave()}
        />
      ) : null}

      {showCancelConfirm ? (
        <SetupCancelConfirmModal
          onClose={() => setShowCancelConfirm(false)}
          onConfirm={() => void handleConfirmCancel()}
        />
      ) : null}
    </main>
  )
}

function SetupSaveConfirmModal({
  lines,
  saving,
  onClose,
  onConfirm,
}: {
  lines: string[]
  saving: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  useEffect(() => {
    function handleKeyDown(e: Event) {
      if (e instanceof KeyboardEvent && e.key === "Escape" && !saving) onClose()
    }
    document.addEventListener("keydown", handleKeyDown)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = ""
    }
  }, [onClose, saving])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="setup-save-confirm-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl">
        <h3
          id="setup-save-confirm-title"
          className="text-base font-bold text-neutral-900"
        >
          以下の情報で登録してよろしいですか？
        </h3>
        <ul className="mt-3 max-h-64 space-y-1.5 overflow-y-auto text-sm text-neutral-700">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            修正する
          </Button>
          <Button type="button" onClick={onConfirm} disabled={saving}>
            {saving ? "登録中..." : "登録する"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function SetupCancelConfirmModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void
  onConfirm: () => void
}) {
  useEffect(() => {
    function handleKeyDown(e: Event) {
      if (e instanceof KeyboardEvent && e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKeyDown)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = ""
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="setup-cancel-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl">
        <h3
          id="setup-cancel-title"
          className="text-base font-bold text-neutral-900"
        >
          確認
        </h3>
        <p className="mt-2 text-sm text-neutral-700">
          初期設定（サロン情報・営業日/時間）の入力内容を破棄してログイン画面に戻りますか？
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button type="button" onClick={onConfirm}>
            ログイン画面へ
          </Button>
        </div>
      </div>
    </div>
  )
}
