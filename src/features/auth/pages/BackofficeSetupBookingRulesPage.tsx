import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { useLocation, useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ROUTES } from "@/constants/routes"
import {
  fetchAdminBookingRules,
  putBookingRules,
} from "@/features/admin/api/adminSettingsApi"
import { postAdminLogout } from "@/features/auth/api/adminLoginApi"
import {
  canAccessSalonSettingsStep,
  isAdminSalonSettingsFlow,
  resolveAdminSalonReturnTo,
  type SalonSettingsFlowNavState,
} from "@/features/auth/lib/salonSettingsNavState"
import { clearSignupVerification } from "@/features/auth/lib/signupVerification"

const STORAGE_KEY = "backoffice_initial_setup_booking_rules_v1"
const BUSINESS_HOURS_STORAGE_KEY = "backoffice_initial_setup_business_hours_v1"
const INITIAL_SETUP_DRAFT_KEY = "backoffice_initial_setup_draft_v1"
const BACK_NAV_BLOCKED_MESSAGE =
  "ブラウザの戻るボタンはご利用いただけません。セッション整合のため、この画面では履歴による前のページへの戻り移動を行っていません。"

const DEFAULTS = {
  allow_same_day: true,
  booking_deadline_minutes: 120,
  buffer_minutes: 0,
  slot_increment_minutes: 15,
  cancellation_deadline_hours: 2,
  max_advance_days: 60,
} as const

type BookingRulesForm = {
  allow_same_day: boolean
  booking_deadline_minutes: string
  buffer_minutes: string
  slot_increment_minutes: string
  cancellation_deadline_hours: string
  max_advance_days: string
}

type BookingRulesDraft = BookingRulesForm & { email: string }

type BookingRulesPayload = {
  allow_same_day: boolean
  booking_deadline_minutes: number
  buffer_minutes: number
  slot_increment_minutes: number
  cancellation_deadline_hours: number
  max_advance_days: number
}

function formFromDefaults(): BookingRulesForm {
  return {
    allow_same_day: DEFAULTS.allow_same_day,
    booking_deadline_minutes: String(DEFAULTS.booking_deadline_minutes),
    buffer_minutes: String(DEFAULTS.buffer_minutes),
    slot_increment_minutes: String(DEFAULTS.slot_increment_minutes),
    cancellation_deadline_hours: String(DEFAULTS.cancellation_deadline_hours),
    max_advance_days: String(DEFAULTS.max_advance_days),
  }
}

function loadDraft(): BookingRulesDraft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<BookingRulesDraft> | null
    if (!parsed || typeof parsed !== "object") return null
    return {
      email: typeof parsed.email === "string" ? parsed.email : "",
      allow_same_day: Boolean(parsed.allow_same_day),
      booking_deadline_minutes:
        typeof parsed.booking_deadline_minutes === "string"
          ? parsed.booking_deadline_minutes
          : String(DEFAULTS.booking_deadline_minutes),
      buffer_minutes:
        typeof parsed.buffer_minutes === "string"
          ? parsed.buffer_minutes
          : String(DEFAULTS.buffer_minutes),
      slot_increment_minutes:
        typeof parsed.slot_increment_minutes === "string"
          ? parsed.slot_increment_minutes
          : String(DEFAULTS.slot_increment_minutes),
      cancellation_deadline_hours:
        typeof parsed.cancellation_deadline_hours === "string"
          ? parsed.cancellation_deadline_hours
          : String(DEFAULTS.cancellation_deadline_hours),
      max_advance_days:
        typeof parsed.max_advance_days === "string"
          ? parsed.max_advance_days
          : String(DEFAULTS.max_advance_days),
    }
  } catch {
    return null
  }
}

function parsePositiveInt(s: string, field: keyof BookingRulesPayload): number | null {
  const t = s.trim()
  if (!/^\d+$/.test(t)) return null
  const n = Number(t)
  if (!Number.isFinite(n) || n < 0) return null
  if (field === "max_advance_days" && n < 1) return null
  if (field === "slot_increment_minutes" && n < 1) return null
  return n
}

function buildSummary(form: BookingRulesForm): string[] {
  return [
    `当日予約: ${form.allow_same_day ? "許可する" : "許可しない"}`,
    `予約締切: 予約開始の ${form.booking_deadline_minutes.trim()} 分前まで`,
    `予約間バッファ: ${form.buffer_minutes.trim()} 分`,
    `空き枠の時間刻み: ${form.slot_increment_minutes.trim()} 分`,
    `キャンセル期限: 予約開始の ${form.cancellation_deadline_hours.trim()} 時間前まで`,
    `予約受付期間: 最大 ${form.max_advance_days.trim()} 日先まで`,
  ]
}

export function BackofficeSetupBookingRulesPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const navState = location.state as SalonSettingsFlowNavState | null
  const fromBusinessHours = Boolean(navState?.fromBusinessHours)
  const fromAdminSalonSettings = isAdminSalonSettingsFlow(navState)
  const stateEmail = typeof navState?.email === "string" ? navState.email : ""

  const stored = useMemo(() => loadDraft(), [])
  const initialEmail = stateEmail || stored?.email || ""

  const [form, setForm] = useState<BookingRulesForm>(() =>
    stored
      ? {
          allow_same_day: stored.allow_same_day,
          booking_deadline_minutes: stored.booking_deadline_minutes,
          buffer_minutes: stored.buffer_minutes,
          slot_increment_minutes: stored.slot_increment_minutes,
          cancellation_deadline_hours: stored.cancellation_deadline_hours,
          max_advance_days: stored.max_advance_days,
        }
      : formFromDefaults(),
  )
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [showSaveConfirm, setShowSaveConfirm] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [backNavigateNotice, setBackNavigateNotice] = useState("")
  const restoreStateRef = useRef<unknown>(null)
  restoreStateRef.current = location.state

  useEffect(() => {
    if (!canAccessSalonSettingsStep(navState, { requireBusinessHours: true })) {
      navigate(ROUTES.backofficeSetupBusinessHours, { replace: true })
    }
  }, [navState, navigate])

  useEffect(() => {
    if (!canAccessSalonSettingsStep(navState, { requireBusinessHours: true })) return
    let cancelled = false
    void fetchAdminBookingRules()
      .then((rules) => {
        if (cancelled || !rules || stored) return
        setForm({
          allow_same_day: rules.allow_same_day,
          booking_deadline_minutes: String(rules.booking_deadline_minutes),
          buffer_minutes: String(rules.buffer_minutes),
          slot_increment_minutes: String(rules.slot_increment_minutes),
          cancellation_deadline_hours: String(rules.cancellation_deadline_hours),
          max_advance_days: String(rules.max_advance_days),
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [navState, stored])

  useLayoutEffect(() => {
    if (!canAccessSalonSettingsStep(navState, { requireBusinessHours: true })) return
    function onPopState(e: PopStateEvent) {
      e.stopImmediatePropagation()
      setBackNavigateNotice(BACK_NAV_BLOCKED_MESSAGE)
      navigate(ROUTES.backofficeSetupBookingRules, {
        replace: true,
        state: restoreStateRef.current ?? {
          fromBusinessHours,
          email: initialEmail,
        },
      })
    }
    window.addEventListener("popstate", onPopState, { capture: true })
    return () =>
      window.removeEventListener("popstate", onPopState, { capture: true })
  }, [navState, fromBusinessHours, initialEmail, navigate])

  function validateForm(): BookingRulesPayload | null {
    const deadline = parsePositiveInt(
      form.booking_deadline_minutes,
      "booking_deadline_minutes",
    )
    const buffer = parsePositiveInt(form.buffer_minutes, "buffer_minutes")
    const slot = parsePositiveInt(
      form.slot_increment_minutes,
      "slot_increment_minutes",
    )
    const cancelH = parsePositiveInt(
      form.cancellation_deadline_hours,
      "cancellation_deadline_hours",
    )
    const maxDays = parsePositiveInt(form.max_advance_days, "max_advance_days")

    if (deadline === null) {
      setError("予約締切は0以上の整数（分）で入力してください。")
      return null
    }
    if (buffer === null) {
      setError("予約間バッファ時間は0以上の整数（分）で入力してください。")
      return null
    }
    if (slot === null) {
      setError("空き枠の時間刻みは1以上の整数（分）で入力してください。")
      return null
    }
    if (cancelH === null) {
      setError("キャンセル期限は0以上の整数（時間）で入力してください。")
      return null
    }
    if (maxDays === null) {
      setError("予約受付期間は1以上の整数（日）で入力してください。")
      return null
    }

    return {
      allow_same_day: form.allow_same_day,
      booking_deadline_minutes: deadline,
      buffer_minutes: buffer,
      slot_increment_minutes: slot,
      cancellation_deadline_hours: cancelH,
      max_advance_days: maxDays,
    }
  }

  function handleRequestConfirm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!validateForm()) return
    setError("")
    setShowSaveConfirm(true)
  }

  async function confirmSave() {
    const payload = validateForm()
    if (!payload) {
      setShowSaveConfirm(false)
      return
    }

    setSaving(true)
    try {
      const result = await putBookingRules(payload)
      if (result.kind === "unauthorized") {
        setError(
          "認証セッションが切れています。お手数ですがログイン画面から再度ログインしてください。",
        )
        return
      }
      if (result.kind !== "ok") {
        setError(
          result.message
            ? `予約ルールの保存に失敗しました（${result.message}）。`
            : "予約ルールの保存に失敗しました。時間をおいて再度お試しください。",
        )
        return
      }

      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ email: initialEmail, ...form }),
        )
      } catch {
        // ignore
      }

      if (fromAdminSalonSettings) {
        navigate(resolveAdminSalonReturnTo(navState), { replace: true })
        return
      }

      navigate(ROUTES.backofficeSetupDone, {
        replace: true,
        state: { fromBookingRules: true, email: initialEmail },
      })
    } finally {
      setSaving(false)
      setShowSaveConfirm(false)
    }
  }

  async function handleConfirmCancel() {
    setShowCancelConfirm(false)
    try {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(BUSINESS_HOURS_STORAGE_KEY)
      localStorage.removeItem(INITIAL_SETUP_DRAFT_KEY)
    } catch {
      // ignore
    }
    clearSignupVerification()
    await postAdminLogout()
    navigate(ROUTES.backofficeLogin, { replace: true })
  }

  const summaryLines = buildSummary(form)

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
            初期設定 - ステップ 3 / 3
          </p>
        ) : null}
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">予約ルールの登録</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {!fromAdminSalonSettings
            ? "お客様の予約・キャンセルに関するルールを設定します。後からも変更できます。"
            : "お客様の予約・キャンセルに関するルールを設定します。"}
        </p>
        {initialEmail ? (
          <p className="mt-2 text-xs text-emerald-700">
            認証済みメールアドレス:{" "}
            <span className="font-mono">{initialEmail}</span>
          </p>
        ) : null}
      </div>

      <form onSubmit={handleRequestConfirm} className="space-y-5">
        <fieldset className="space-y-2 border-0 p-0">
          <legend className="text-sm font-medium leading-none">当日予約を許可しますか？</legend>
          <div className="flex flex-wrap gap-6">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <input
                type="radio"
                name="allow-same-day"
                className="size-4 accent-black"
                checked={form.allow_same_day === true}
                onChange={() => {
                  setForm((f) => ({ ...f, allow_same_day: true }))
                  setError("")
                }}
                disabled={saving}
              />
              許可する
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <input
                type="radio"
                name="allow-same-day"
                className="size-4 accent-black"
                checked={form.allow_same_day === false}
                onChange={() => {
                  setForm((f) => ({ ...f, allow_same_day: false }))
                  setError("")
                }}
                disabled={saving}
              />
              許可しない
            </label>
          </div>
        </fieldset>

        <div className="space-y-2">
          <Label htmlFor="booking-deadline">予約締切（分）</Label>
          <p className="text-xs text-muted-foreground">
            予約を施術開始時刻の何分前まで受け付けるか、設定してください。
          </p>
          <Input
            id="booking-deadline"
            type="number"
            min={0}
            step={1}
            value={form.booking_deadline_minutes}
            onChange={(e) => {
              setForm((f) => ({ ...f, booking_deadline_minutes: e.target.value }))
              setError("")
            }}
            className="max-w-[200px]"
            disabled={saving}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="buffer-minutes">予約間バッファ時間（分）</Label>
          <p className="text-xs text-muted-foreground">
            施術と施術の間に何分空けるか、設定してください。
          </p>
          <Input
            id="buffer-minutes"
            type="number"
            min={0}
            step={1}
            value={form.buffer_minutes}
            onChange={(e) => {
              setForm((f) => ({ ...f, buffer_minutes: e.target.value }))
              setError("")
            }}
            className="max-w-[200px]"
            disabled={saving}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="slot-increment">空き枠の時間刻み（分）</Label>
          <p className="text-xs text-muted-foreground">
            予約可能な時間の刻み幅を何分にするか、設定してください。
          </p>
          <Input
            id="slot-increment"
            type="number"
            min={1}
            step={1}
            value={form.slot_increment_minutes}
            onChange={(e) => {
              setForm((f) => ({ ...f, slot_increment_minutes: e.target.value }))
              setError("")
            }}
            className="max-w-[200px]"
            disabled={saving}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cancellation-deadline">キャンセル期限（時間）</Label>
          <p className="text-xs text-muted-foreground">
            予約開始の何時間前までキャンセル可能にするか、設定してください。
          </p>
          <Input
            id="cancellation-deadline"
            type="number"
            min={0}
            step={1}
            value={form.cancellation_deadline_hours}
            onChange={(e) => {
              setForm((f) => ({
                ...f,
                cancellation_deadline_hours: e.target.value,
              }))
              setError("")
            }}
            className="max-w-[200px]"
            disabled={saving}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="max-advance-days">予約受付期間（日）</Label>
          <p className="text-xs text-muted-foreground">
            何日先まで予約を受け付けるか、設定してください。
          </p>
          <Input
            id="max-advance-days"
            type="number"
            min={1}
            step={1}
            value={form.max_advance_days}
            onChange={(e) => {
              setForm((f) => ({ ...f, max_advance_days: e.target.value }))
              setError("")
            }}
            className="max-w-[200px]"
            disabled={saving}
          />
        </div>

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
              登録をやめる
            </Button>
          ) : null}
          <Button type="submit" disabled={saving}>
            {saving ? "保存中..." : "登録内容を確認"}
          </Button>
        </div>
      </form>

      {showSaveConfirm ? (
        <SetupSaveConfirmModal
          lines={summaryLines}
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
        <ul className="mt-3 space-y-1.5 text-sm text-neutral-700">
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
          初期設定の入力内容を破棄してログイン画面に戻りますか？
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
