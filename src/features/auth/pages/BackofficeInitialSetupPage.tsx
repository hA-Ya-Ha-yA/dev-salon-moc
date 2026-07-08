import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from "react"
import { useLocation, useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ROUTES } from "@/constants/routes"
import { putAdminProfile } from "@/features/admin/api/adminProfileApi"
import {
  InitialSetupAddressFields,
  type InitialSetupAddressValue,
} from "@/features/auth/components/InitialSetupAddressFields"
import { postAdminLogout, postAdminSignup } from "@/features/auth/api/adminLoginApi"
import { composeSalonAddress } from "@/features/auth/lib/formatSalonAddress"
import { clearSignupVerification } from "@/features/auth/lib/signupVerification"

const EMPTY_ADDRESS: InitialSetupAddressValue = {
  postalCode: "",
  prefecture: "",
  municipality: "",
  street: "",
  building: "",
}

type InitialSetupDraft = {
  email: string
  password: string
  passwordConfirm: string
  addressPostalCode: string
  addressPrefecture: string
  addressMunicipality: string
  addressStreet: string
  addressBuilding: string
  phone: string
  salonName: string
  salonMessage: string
  salonDescription: string
  cancelPolicy: string
  instagramUrl: string
  lineOfficialUrl: string
  websiteUrl: string
}

const STORAGE_KEY = "backoffice_initial_setup_draft_v1"
const PASSWORD_MIN = 6
const PASSWORD_MAX = 200

function validateOptionalUrl(value: string, label: string): string | null {
  const v = value.trim()
  if (!v) return null
  if (v.length > 500) return `${label}は500文字以内で入力してください。`
  try {
    const parsed = new URL(v)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return `${label}は http:// または https:// で始まるURLを入力してください。`
    }
  } catch {
    return `${label}は有効なURL形式で入力してください。`
  }
  return null
}

function toInitialSetupDraft(
  form: FormData,
  email: string,
  address: InitialSetupAddressValue,
): InitialSetupDraft {
  return {
    email,
    password: String(form.get("password") ?? ""),
    passwordConfirm: String(form.get("passwordConfirm") ?? ""),
    addressPostalCode: address.postalCode.trim(),
    addressPrefecture: address.prefecture.trim(),
    addressMunicipality: address.municipality.trim(),
    addressStreet: address.street.trim(),
    addressBuilding: address.building.trim(),
    phone: String(form.get("phone") ?? "").trim(),
    salonName: String(form.get("salonName") ?? "").trim(),
    salonMessage: String(form.get("salonMessage") ?? "").trim(),
    salonDescription: String(form.get("salonDescription") ?? "").trim(),
    cancelPolicy: String(form.get("cancelPolicy") ?? "").trim(),
    instagramUrl: String(form.get("instagramUrl") ?? "").trim(),
    lineOfficialUrl: String(form.get("lineOfficialUrl") ?? "").trim(),
    websiteUrl: String(form.get("websiteUrl") ?? "").trim(),
  }
}

/** `localStorage` に下書きを残すときは平文パスワードを除外する。 */
function toPersistedDraft(draft: InitialSetupDraft): Omit<InitialSetupDraft, "password" | "passwordConfirm"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, passwordConfirm, ...rest } = draft
  return rest
}

const BACK_NAV_BLOCKED_MESSAGE =
  "ブラウザの戻るボタンはご利用いただけません。セッション整合のため、この画面では履歴による前のページへの戻り移動を行っていません。"

export function BackofficeInitialSetupPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [backNavigateNotice, setBackNavigateNotice] = useState("")
  const [address, setAddress] = useState<InitialSetupAddressValue>(EMPTY_ADDRESS)
  const restoreStateRef = useRef<unknown>(null)

  const navState = location.state as
    | { fromSignup?: boolean; email?: string }
    | null
  const fromSignup = Boolean(navState?.fromSignup)
  const email = typeof navState?.email === "string" ? navState.email : ""

  restoreStateRef.current = location.state

  // 直接アクセス（state 無し）の場合は新規登録画面に戻す
  useEffect(() => {
    if (!fromSignup && !email) {
      navigate(ROUTES.backofficeSignup, { replace: true })
    }
  }, [fromSignup, email, navigate])

  // BrowserRouter では useBlocker が使えないため、popstate を capture で先取りし、
  // React Router より先に履歴を元の初期設定へ戻す（戻る／左スワイプの POP 対策）。
  useLayoutEffect(() => {
    if (!fromSignup && !email) return

    function onPopState(e: PopStateEvent) {
      e.stopImmediatePropagation()
      setBackNavigateNotice(BACK_NAV_BLOCKED_MESSAGE)
      navigate(ROUTES.backofficeInitialSetup, {
        replace: true,
        state: restoreStateRef.current ?? { fromSignup, email },
      })
    }

    window.addEventListener("popstate", onPopState, { capture: true })
    return () => window.removeEventListener("popstate", onPopState, { capture: true })
  }, [fromSignup, email, navigate])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const draft = toInitialSetupDraft(form, email, address)

    if (!draft.password) {
      setError("パスワードは必須です。")
      return
    }
    if (draft.password.length < PASSWORD_MIN || draft.password.length > PASSWORD_MAX) {
      setError(`パスワードは${PASSWORD_MIN}文字以上${PASSWORD_MAX}文字以内で入力してください。`)
      return
    }
    if (draft.password !== draft.passwordConfirm) {
      setError("パスワード（確認用）が一致しません。")
      return
    }
    if (!draft.addressPrefecture) {
      setError("都道府県を選択してください。")
      return
    }
    if (!draft.addressMunicipality) {
      setError("市区町村を選択してください。")
      return
    }
    if (!draft.addressStreet) {
      setError("町名・番地を入力してください。")
      return
    }
    const composedAddress = composeSalonAddress({
      prefecture: draft.addressPrefecture,
      municipality: draft.addressMunicipality,
      street: draft.addressStreet,
      building: draft.addressBuilding || undefined,
    })
    if (composedAddress.length > 500) {
      setError("住所全体は500文字以内で入力してください。")
      return
    }
    if (!draft.phone) {
      setError("電話番号は必須です。")
      return
    }
    if (!/^\d{1,20}$/.test(draft.phone)) {
      setError("電話番号は20桁以下の数字のみで入力してください。")
      return
    }
    if (!draft.salonName) {
      setError("サロン名は必須です。")
      return
    }
    if (draft.salonName.length > 200) {
      setError("サロン名は200文字以内で入力してください。")
      return
    }
    const igErr = validateOptionalUrl(draft.instagramUrl, "Instagram URL")
    if (igErr) {
      setError(igErr)
      return
    }
    const lineErr = validateOptionalUrl(draft.lineOfficialUrl, "LINE公式アカウントURL")
    if (lineErr) {
      setError(lineErr)
      return
    }
    const webErr = validateOptionalUrl(draft.websiteUrl, "WebサイトURL")
    if (webErr) {
      setError(webErr)
      return
    }

    setError("")
    setSaving(true)
    try {
      // 1. POST /api/admin/signup — salons + salon_profiles（slug 自動採番）+ admin_users を作成
      const signupResult = await postAdminSignup({
        email: draft.email,
        password: draft.password,
        name: draft.salonName, // 管理者表示名はサロン名を流用
        salon_name: draft.salonName,
      })
      if (signupResult.kind === "duplicate_email") {
        setError(
          signupResult.message ||
            "このメールアドレスは既に登録されています。ログイン画面からログインしてください。",
        )
        return
      }
      if (signupResult.kind === "validation") {
        setError(
          signupResult.message
            ? `入力内容に誤りがあります: ${signupResult.message}`
            : "入力内容に誤りがあります。各項目をご確認ください。",
        )
        return
      }
      if (signupResult.kind === "error") {
        setError(
          signupResult.message
            ? `新規登録に失敗しました（${signupResult.message}）。時間をおいて再度お試しください。`
            : "新規登録に失敗しました。時間をおいて再度お試しください。",
        )
        return
      }

      // 2. PUT /api/admin/profile — salon_profiles に詳細情報を反映
      //    （phone/address/SNS/メッセージ/紹介文/ポリシー）
      const profilePayload: Parameters<typeof putAdminProfile>[0] = {
        phone: draft.phone,
        address: composedAddress,
      }
      if (draft.salonMessage) profilePayload.booking_page_message = draft.salonMessage
      if (draft.salonDescription) profilePayload.description = draft.salonDescription
      if (draft.cancelPolicy) profilePayload.cancellation_policy_text = draft.cancelPolicy
      if (draft.instagramUrl) profilePayload.instagram_url = draft.instagramUrl
      if (draft.lineOfficialUrl) profilePayload.line_url = draft.lineOfficialUrl
      if (draft.websiteUrl) profilePayload.website_url = draft.websiteUrl

      const profileResult = await putAdminProfile(profilePayload)
      if (profileResult.kind !== "ok") {
        const msg =
          profileResult.kind === "conflict"
            ? profileResult.message ||
              "サロン情報の保存で競合が発生しました。値をご確認ください。"
            : profileResult.kind === "unauthorized"
              ? "認証セッションの確立に失敗しました。お手数ですがログイン画面から再度ログインしてください。"
              : profileResult.message
                ? `サロン情報の保存に失敗しました（${profileResult.message}）。`
                : "サロン情報の保存に失敗しました。時間をおいて再度お試しください。"
        setError(msg)
        return
      }

      // 下書きを localStorage に保存（パスワードは除外）
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toPersistedDraft(draft)))
      } catch {
        // ignore storage 失敗（QuotaExceededError 等）
      }
      // 認証メールリンクの記録は役目を終えたので破棄
      clearSignupVerification()

      navigate(ROUTES.backofficeSetupBusinessHours, {
        replace: true,
        state: { fromInitialSetup: true, email: draft.email },
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirmCancel() {
    setShowCancelConfirm(false)
    try {
      localStorage.removeItem(STORAGE_KEY)
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
        <h1 className="text-2xl font-semibold tracking-tight">初期設定</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          サロン情報とログイン用パスワードを入力してください。
        </p>
        <p className="mt-1 text-sm font-medium text-foreground">
          <span className="text-destructive">※</span>
          は入力必須の項目です。
        </p>
        {fromSignup ? (
          <div
            role="status"
            className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          >
            メール認証が完了しました。引き続き初期設定を行ってください。
            {email ? (
              <div className="mt-1 text-xs text-emerald-700">
                認証済みメールアドレス: <span className="font-mono">{email}</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="パスワード" htmlFor="initial-password" required>
          <Input
            id="initial-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN}
            maxLength={PASSWORD_MAX}
            placeholder={`${PASSWORD_MIN}文字以上`}
          />
        </Field>

        <Field label="パスワード（確認用）" htmlFor="initial-password-confirm" required>
          <Input
            id="initial-password-confirm"
            name="passwordConfirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN}
            maxLength={PASSWORD_MAX}
            placeholder="同じパスワードを入力"
          />
        </Field>

        <InitialSetupAddressFields
          value={address}
          onChange={setAddress}
          disabled={saving}
        />

        <Field label="電話番号" htmlFor="initial-phone" required>
          <Input
            id="initial-phone"
            name="phone"
            required
            inputMode="numeric"
            pattern="[0-9]{1,20}"
            maxLength={20}
            placeholder="0312345678"
          />
        </Field>

        <Field label="サロン名" htmlFor="initial-salon-name" required>
          <Input id="initial-salon-name" name="salonName" required maxLength={200} />
        </Field>

        <Field
          label="サロンメッセージ（予約ページ上部に表示する）"
          htmlFor="initial-message"
        >
          <textarea
            id="initial-message"
            name="salonMessage"
            className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </Field>

        <Field label="サロン紹介文" htmlFor="initial-description">
          <textarea
            id="initial-description"
            name="salonDescription"
            className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </Field>

        <Field label="キャンセルポリシー文" htmlFor="initial-cancel-policy">
          <textarea
            id="initial-cancel-policy"
            name="cancelPolicy"
            className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </Field>

        <Field label="Instagram URL" htmlFor="initial-instagram-url">
          <Input id="initial-instagram-url" name="instagramUrl" maxLength={500} />
        </Field>

        <Field label="LINE公式アカウントURL" htmlFor="initial-line-url">
          <Input id="initial-line-url" name="lineOfficialUrl" maxLength={500} />
        </Field>

        <Field label="WebサイトURL" htmlFor="initial-website-url">
          <Input id="initial-website-url" name="websiteUrl" maxLength={500} />
        </Field>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => setShowCancelConfirm(true)}
          >
            戻る
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "登録中..." : "初期設定を保存"}
          </Button>
        </div>
      </form>

      {showCancelConfirm ? (
        <InitialSetupCancelConfirmModal
          onClose={() => setShowCancelConfirm(false)}
          onConfirm={() => void handleConfirmCancel()}
        />
      ) : null}
    </main>
  )
}

function InitialSetupCancelConfirmModal({
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
      aria-labelledby="initial-setup-cancel-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl">
        <h3
          id="initial-setup-cancel-title"
          className="text-base font-bold text-neutral-900"
        >
          確認
        </h3>
        <p className="mt-2 text-sm text-neutral-700">
          新規登録と初期設定を取り消し、ログイン画面に戻りますか？この画面で入力した内容は保存されません。
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button type="button" onClick={onConfirm}>
            はい、ログイン画面へ
          </Button>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string
  htmlFor: string
  /** 入力必須の場合、ラベルに赤い ※ を表示 */
  required?: boolean
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>
        {label}
        {required ? (
          <span className="ml-0.5 text-destructive" title="必須" aria-hidden>
            ※
          </span>
        ) : null}
      </Label>
      {children}
    </div>
  )
}
