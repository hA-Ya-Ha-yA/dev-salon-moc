import { useEffect, useState, type ReactNode } from "react"
import { Link, useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ROUTES } from "@/constants/routes"
import { useAdminProfile } from "@/features/auth/context/AdminProfileContext"

const AUTO_REDIRECT_MS = 4000

/**
 * `admin_users.role === "owner"` のみが入れるルート。
 * staff（=`role !== "owner"`）の場合は「権限がありません」を表示し、
 * 数秒後にダッシュボードへ案内する。
 */
export function OwnerOnlyRoute({ children }: { children: ReactNode }) {
  const profile = useAdminProfile()
  const navigate = useNavigate()
  const [countdown, setCountdown] = useState(Math.ceil(AUTO_REDIRECT_MS / 1000))

  const allowed = profile.role === "owner"

  useEffect(() => {
    if (allowed) return
    const start = Date.now()
    const tick = window.setInterval(() => {
      const remainingMs = AUTO_REDIRECT_MS - (Date.now() - start)
      if (remainingMs <= 0) {
        window.clearInterval(tick)
        navigate(ROUTES.adminHome, { replace: true })
        return
      }
      setCountdown(Math.max(0, Math.ceil(remainingMs / 1000)))
    }, 250)
    return () => window.clearInterval(tick)
  }, [allowed, navigate])

  if (allowed) return <>{children}</>

  return (
    <Card className="border-border shadow-xs">
      <CardContent className="space-y-3 py-6">
        <h2 className="text-base font-semibold">この機能の権限がありません</h2>
        <p className="text-sm text-muted-foreground">
          スタッフ管理／メニュー管理など、管理者（owner）のみが利用できる機能です。
          {countdown}秒後にダッシュボードへ自動的に戻ります。
        </p>
        <div className="flex gap-2">
          <Button asChild type="button" size="sm">
            <Link to={ROUTES.adminHome}>今すぐダッシュボードへ</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
