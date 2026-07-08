import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ArrowRight, Mail } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ROUTES } from "@/constants/routes"
import { checkAdminEmailExists } from "@/features/auth/api/adminLoginApi"
import { requestSignupVerificationEmail } from "@/features/auth/api/signupVerificationApi"
import { AuthBrandingPanel, AuthMobileBrandingHeader } from "@/features/auth/components/AuthBrandingPanel"
import { AUTH_AUDIENCE_TEXT } from "@/features/auth/constants"

const REDIRECT_DELAY_MS = 2500
const audienceText = AUTH_AUDIENCE_TEXT.BACKOFFICE_PORTAL

export function BackofficeSignupEmailPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [duplicateNotice, setDuplicateNotice] = useState("")

  useEffect(() => {
    if (!duplicateNotice) return
    const timerId = window.setTimeout(() => {
      navigate(ROUTES.backofficeLogin, { replace: true })
    }, REDIRECT_DELAY_MS)
    return () => window.clearTimeout(timerId)
  }, [duplicateNotice, navigate])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting || duplicateNotice) return
    const trimmed = email.trim()
    if (!trimmed) {
      setError("メールアドレスを入力してください。")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("メールアドレスの形式が正しくありません。")
      return
    }

    setError("")
    setSubmitting(true)
    try {
      const result = await checkAdminEmailExists(trimmed)
      if (result.kind === "taken") {
        setDuplicateNotice(
          "すでにそのメールアドレスは登録されています。ログイン画面に移動します…",
        )
        return
      }
      if (result.kind === "error") {
        setError(
          result.message
            ? `登録可否の確認に失敗しました（${result.message}）。時間をおいて再度お試しください。`
            : "登録可否の確認に失敗しました。時間をおいて再度お試しください。",
        )
        return
      }
      const sendResult = await requestSignupVerificationEmail({ email: trimmed })
      if (sendResult.kind === "duplicate_email") {
        setDuplicateNotice(
          sendResult.message ||
            "すでにそのメールアドレスは登録されています。ログイン画面に移動します…",
        )
        return
      }
      if (sendResult.kind !== "ok") {
        setError(
          sendResult.message
            ? `認証メールの送信に失敗しました（${sendResult.message}）。時間をおいて再度お試しください。`
            : "認証メールの送信に失敗しました。時間をおいて再度お試しください。",
        )
        return
      }
      navigate(ROUTES.backofficeSignupVerifySent, {
        replace: true,
        state: {
          email: sendResult.email,
          expiresAt: sendResult.expiresAt,
        },
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main
      className="flex min-h-dvh bg-white"
      style={{ fontFamily: "'SF Pro Text', 'SF Pro Display', 'Noto Sans JP', sans-serif" }}
    >
      <AuthBrandingPanel
        audienceTitle={audienceText.title}
        audienceDescription={audienceText.description}
      />

      {/* --- Right form panel (新規登録専用) --- */}
      <div className="flex flex-1 flex-col">
        <AuthMobileBrandingHeader />

        <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-[400px]">
            <div className="mb-8">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-400">
                {audienceText.title}
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-neutral-900">
                新規登録
              </h2>
              <p className="mt-1 text-sm text-neutral-500">
                ご利用のメールアドレスを入力してください。認証メールをお送りします。
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <FieldGroup label="メールアドレス">
                <Input
                  id="signup-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setError("")
                  }}
                  disabled={submitting || Boolean(duplicateNotice)}
                  required
                  className="h-11 rounded-lg border-neutral-200 bg-neutral-50 text-sm transition-colors focus:border-black focus:bg-white focus:ring-1 focus:ring-black"
                />
              </FieldGroup>

              <Button
                type="submit"
                disabled={submitting || Boolean(duplicateNotice)}
                className="group h-11 w-full rounded-lg bg-black text-sm font-semibold text-white transition-all hover:bg-neutral-800 disabled:opacity-60"
              >
                <Mail className="mr-1.5 size-4" />
                {submitting ? "送信中..." : "認証メールを送信"}
                <ArrowRight className="ml-1.5 size-4 transition-transform group-hover:translate-x-0.5" />
              </Button>

              {duplicateNotice ? (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-3"
                >
                  <p className="text-sm text-red-700">{duplicateNotice}</p>
                </div>
              ) : null}

              {error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                  <p className="whitespace-pre-line text-sm text-red-700">{error}</p>
                </div>
              ) : null}
            </form>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-5">
              <div className="text-sm text-neutral-500">
                <span>すでにアカウントをお持ちの方</span>
                <Link
                  to={ROUTES.backofficeLogin}
                  className="ml-1 font-semibold text-black underline decoration-neutral-300 underline-offset-4 transition-colors hover:decoration-black"
                >
                  ログインへ
                </Link>
              </div>
            </div>

            <div className="mt-4">
              <Link
                to={ROUTES.landing}
                className="text-sm text-neutral-500 underline decoration-neutral-300 underline-offset-4 transition-colors hover:text-neutral-800"
              >
                トップへ戻る
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

function FieldGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-neutral-700">{label}</Label>
      {children}
    </div>
  )
}
