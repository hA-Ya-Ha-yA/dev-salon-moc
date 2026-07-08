import { ArrowLeft, Dumbbell } from "lucide-react"
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { ROUTES } from "@/constants/routes"
import { useSalonName } from "@/features/user/hooks/useSalonName"
import { buildPathWithShopId, useShopId } from "@/features/user/hooks/useShopId"

function getPageTitle(pathname: string): string {
  if (pathname === ROUTES.userHome) return "トップページ"
  if (pathname === ROUTES.userReservationLookup) return "予約照会"
  if (pathname === ROUTES.userReservationList) return "予約照会"
  if (pathname.startsWith("/user/reservations/")) return "予約詳細"
  if (pathname === ROUTES.userReservationNomination) return "トレーナー・メニュー選択"
  if (pathname === ROUTES.userReservationChangeMode) return "予約変更"
  if (pathname === ROUTES.userReservationSchedule) return "予約内容入力"
  if (pathname === ROUTES.userReservationInput) return "予約者情報入力"
  if (pathname === ROUTES.userReservationConfirm) return "予約内容の確認"
  if (pathname === ROUTES.userReservationPaypayReturn) return "PayPay決済"
  return "予約画面"
}

export function UserLayout() {
  const shopId = useShopId()
  const navigate = useNavigate()
  const location = useLocation()
  const salonName = useSalonName(shopId)

  const isTopLevel = location.pathname === ROUTES.userHome
  const pageTitle = getPageTitle(location.pathname)

  function handleBack() {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate(buildPathWithShopId(ROUTES.userHome, shopId))
  }

  return (
    <main className="min-h-dvh bg-white">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-lg">
        <div className="relative mx-auto grid h-14 max-w-5xl grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-6">
          <div className="flex items-center gap-3">
            {!isTopLevel ? (
              <Button
                variant="ghost"
                size="icon"
                className="size-11 rounded-full"
                type="button"
                onClick={handleBack}
                aria-label="前の画面へ戻る"
              >
                <ArrowLeft className="size-4" />
              </Button>
            ) : null}
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-900">
              <Dumbbell className="size-4 text-white" />
            </div>
          </div>
          <Link
            to={buildPathWithShopId(ROUTES.userHome, shopId)}
            className="min-w-0 justify-self-center rounded-md px-2 py-1 text-center transition-colors hover:bg-slate-100"
          >
            <span className="block max-w-[52vw] truncate text-sm font-semibold text-foreground sm:max-w-sm">
              {salonName}
            </span>
          </Link>
          <span className="hidden min-w-0 truncate text-right text-sm font-medium text-muted-foreground sm:block">
            {pageTitle}
          </span>
        </div>
      </header>
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
        <Outlet />
      </div>
    </main>
  )
}
