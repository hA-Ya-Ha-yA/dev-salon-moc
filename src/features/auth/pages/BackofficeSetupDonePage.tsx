import { useEffect } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { ROUTES } from "@/constants/routes"
import {
  isAdminSalonSettingsFlow,
  resolveAdminSalonReturnTo,
  type SalonSettingsFlowNavState,
} from "@/features/auth/lib/salonSettingsNavState"

/**
 * 初期設定（サロン情報→営業日・営業時間→予約ルール）の完了画面。
 */
export function BackofficeSetupDonePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const navState = location.state as SalonSettingsFlowNavState | null
  const email = typeof navState?.email === "string" ? navState.email : ""
  const fromBookingRules = Boolean(navState?.fromBookingRules)
  const fromAdminSalonSettings = isAdminSalonSettingsFlow(navState)

  useEffect(() => {
    if (fromAdminSalonSettings) {
      navigate(resolveAdminSalonReturnTo(navState), { replace: true })
      return
    }
    if (!fromBookingRules) {
      navigate(ROUTES.backofficeInitialSetup, { replace: true })
    }
  }, [fromAdminSalonSettings, fromBookingRules, navState, navigate])

  if (fromAdminSalonSettings) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted-foreground">ダッシュボードへ戻ります…</p>
    )
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center px-4 py-8 sm:px-6">
      <div className="w-full rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-6"
            aria-hidden="true"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">
          初期設定が完了しました
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          サロン情報・営業日/時間・予約ルールの登録が完了しました。
          <br />
          ログインして管理画面をご利用ください。
        </p>
        {email ? (
          <p className="mt-4 text-xs text-emerald-700">
            認証済みメールアドレス: <span className="font-mono">{email}</span>
          </p>
        ) : null}

        <div className="mt-6">
          <Button asChild type="button" className="w-full sm:w-auto">
            <Link to={ROUTES.backofficeLogin}>ログイン画面へ</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
