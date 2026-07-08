import { useCallback, useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { ROUTES } from "@/constants/routes"
import {
  fetchAdminMe,
  type AdminMeProfile,
} from "@/features/auth/api/adminSessionApi"
import { AdminProfileProvider } from "@/features/auth/context/AdminProfileContext"

type GuardStatus = "checking" | "ok" | "error"

const EMPTY_PROFILE: AdminMeProfile = {
  adminId: null,
  name: "",
  avatarUrl: null,
  salonName: null,
  role: "staff",
}

/**
 * 管理者ルート用。Cookie が無効ならログインへ replace し、
 * ブラウザの戻る（bfcache 含む）で画面だけ戻っても再検証する。
 * 認証成功時は `GET /api/admin/me` の内容を `AdminProfileProvider` で子へ渡す。
 */
export function AdminAuthGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [status, setStatus] = useState<GuardStatus>("checking")
  const [profile, setProfile] = useState<AdminMeProfile>(EMPTY_PROFILE)

  const runCheck = useCallback(
    async (signal?: AbortSignal) => {
      setStatus("checking")
      const result = await fetchAdminMe()
      if (signal?.aborted) return
      if (result.kind === "ok") {
        setProfile(result.profile)
        setStatus("ok")
        return
      }
      if (result.kind === "unauthorized") {
        navigate(ROUTES.backofficeLogin, { replace: true })
        return
      }
      setStatus("error")
    },
    [navigate],
  )

  useEffect(() => {
    const ac = new AbortController()
    queueMicrotask(() => {
      void runCheck(ac.signal)
    })
    return () => ac.abort()
  }, [location.pathname, runCheck])

  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return
      void runCheck()
    }
    window.addEventListener("pageshow", onPageShow)
    return () => window.removeEventListener("pageshow", onPageShow)
  }, [runCheck])

  if (status === "checking") {
    return (
      <p className="text-sm text-muted-foreground">読み込み中...</p>
    )
  }

  if (status === "error") {
    return (
      <div className="space-y-3 rounded-lg border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          セッションの確認に失敗しました。ネットワークまたはサーバーを確認してください。
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => void runCheck()}>
          再試行
        </Button>
      </div>
    )
  }

  return (
    <AdminProfileProvider value={profile}>
      {children}
    </AdminProfileProvider>
  )
}
