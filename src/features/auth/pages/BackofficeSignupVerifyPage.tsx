import { useEffect, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { CheckCircle2, Loader2, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ROUTES } from "@/constants/routes"
import {
  verifySignupEmailToken,
  type SignupVerificationConsumeResult,
} from "@/features/auth/api/signupVerificationApi"

const SUCCESS_AUTOPROCEED_MS = 1800
const FAILURE_REDIRECT_MS = 2500

export function BackofficeSignupVerifyPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = (searchParams.get("token") ?? "").trim()
  const hasToken = Boolean(token)

  const [status, setStatus] = useState<"checking" | "success" | "failed">(
    hasToken ? "checking" : "failed",
  )
  const [email, setEmail] = useState<string>("")
  const [failureReason, setFailureReason] = useState<string>(
    hasToken ? "" : "認証リンクが無効です（トークンがありません）。",
  )
  const consumedRef = useRef(false)

  useEffect(() => {
    if (consumedRef.current) return
    consumedRef.current = true

    if (!token) return
    void (async () => {
      const result: SignupVerificationConsumeResult = await verifySignupEmailToken(token)
      if (result.kind === "ok") {
        setEmail(result.email)
        setStatus("success")
        return
      }
      setStatus("failed")
      if (result.kind === "expired") {
        setFailureReason(result.message || "認証リンクの有効期限が切れています。")
      } else if (result.kind === "already_used") {
        setFailureReason(result.message || "この認証リンクはすでに使用済みです。")
      } else {
        setFailureReason(result.message || "認証リンクが無効です。新規登録をやり直してください。")
      }
    })()
  }, [token])

  // 成功時は短い案内のあと初期設定画面へ
  useEffect(() => {
    if (status !== "success") return
    const id = window.setTimeout(() => {
      navigate(ROUTES.backofficeInitialSetup, {
        replace: true,
        state: { email, fromSignup: true },
      })
    }, SUCCESS_AUTOPROCEED_MS)
    return () => window.clearTimeout(id)
  }, [status, email, navigate])

  // 失敗時は新規登録画面へ
  useEffect(() => {
    if (status !== "failed") return
    const id = window.setTimeout(() => {
      navigate(ROUTES.backofficeSignup, { replace: true })
    }, FAILURE_REDIRECT_MS)
    return () => window.clearTimeout(id)
  }, [status, navigate])

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center px-4 py-10 sm:px-6">
      {status === "checking" ? (
        <div
          role="status"
          aria-live="polite"
          className="flex w-full flex-col items-center rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm"
        >
          <Loader2 className="size-10 animate-spin text-neutral-500" />
          <p className="mt-4 text-sm text-neutral-700">認証情報を確認しています…</p>
        </div>
      ) : null}

      {status === "success" ? (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby="signup-verify-success-title"
          className="flex w-full flex-col items-center rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-lg"
        >
          <div className="flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="size-8" />
          </div>
          <h2
            id="signup-verify-success-title"
            className="mt-4 text-xl font-bold tracking-tight text-neutral-900"
          >
            認証に成功しました
          </h2>
          <p className="mt-2 text-sm text-neutral-700">
            {email ? (
              <>
                <span className="font-semibold">{email}</span> の認証が完了しました。
              </>
            ) : (
              <>メールアドレスの認証が完了しました。</>
            )}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            まもなく初期設定画面に移動します…
          </p>
          <div className="mt-5">
            <Button
              type="button"
              onClick={() =>
                navigate(ROUTES.backofficeInitialSetup, {
                  replace: true,
                  state: { email, fromSignup: true },
                })
              }
            >
              今すぐ初期設定へ
            </Button>
          </div>
        </div>
      ) : null}

      {status === "failed" ? (
        <div
          role="alert"
          className="flex w-full flex-col items-center rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm"
        >
          <div className="flex size-14 items-center justify-center rounded-full bg-red-100 text-red-600">
            <XCircle className="size-8" />
          </div>
          <h2 className="mt-4 text-xl font-bold tracking-tight text-neutral-900">
            認証に失敗しました
          </h2>
          <p className="mt-2 text-sm text-neutral-700">{failureReason}</p>
          <p className="mt-1 text-xs text-neutral-500">
            まもなく新規登録画面に戻ります…
          </p>
          <div className="mt-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(ROUTES.backofficeSignup, { replace: true })}
            >
              新規登録に戻る
            </Button>
          </div>
        </div>
      ) : null}
    </main>
  )
}
