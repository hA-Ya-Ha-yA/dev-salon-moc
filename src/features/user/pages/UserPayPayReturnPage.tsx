import { useEffect, useState } from "react"
import { CheckCircle2, Loader2 } from "lucide-react"
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { ROUTES } from "@/constants/routes"
import { finalizePayPayReservation } from "@/features/user/api/userReservationApi"
import { UserSectionCard } from "@/features/user/components/UserSectionCard"
import { buildPathWithShopId } from "@/features/user/hooks/useShopId"
import { persistShopSlug, resolveShopSlug } from "@/lib/shopSlug"

export function UserPayPayReturnPage() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const queryShopId = searchParams.get("shopId")?.trim() || undefined
  const shopId = resolveShopSlug(queryShopId) ?? undefined
  const merchantPaymentId = searchParams.get("merchantPaymentId")?.trim() || ""

  const [isLoading, setIsLoading] = useState(true)
  const [isDone, setIsDone] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!queryShopId) return
    persistShopSlug(queryShopId)
    const nextParams = new URLSearchParams(location.search)
    nextParams.delete("shopId")
    const nextSearch = nextParams.toString()
    navigate(`${location.pathname}${nextSearch ? `?${nextSearch}` : ""}${location.hash}`, {
      replace: true,
    })
  }, [location.hash, location.pathname, location.search, navigate, queryShopId])

  useEffect(() => {
    if (!merchantPaymentId) {
      queueMicrotask(() => {
        setError("PayPay決済情報が見つかりません。")
        setIsLoading(false)
      })
      return
    }

    let active = true
    void finalizePayPayReservation({
      merchantPaymentId,
      shopSlug: shopId,
    }).then((result) => {
      if (!active) return
      if (!result.ok) {
        setError(result.error)
        setIsLoading(false)
        return
      }
      setIsDone(true)
      setIsLoading(false)
    })

    return () => {
      active = false
    }
  }, [merchantPaymentId, shopId])

  if (isLoading) {
    return (
      <section className="space-y-5">
        <UserSectionCard title="PayPay決済確認中" subtitle="支払い結果を確認しています。">
          <div className="flex items-center gap-2 px-6 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <span>決済情報を確認しています...</span>
          </div>
        </UserSectionCard>
      </section>
    )
  }

  if (isDone) {
    return (
      <section className="space-y-5">
        <UserSectionCard title="予約が完了しました" subtitle="PayPay決済と予約確定が完了しました。">
          <div className="flex flex-col items-center px-6 py-8 text-center">
            <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="size-7 text-emerald-600" />
            </div>
            <p className="text-sm text-muted-foreground">予約が完了しました。</p>
            <Button asChild className="mt-6 rounded-xl">
              <Link to={buildPathWithShopId(ROUTES.userHome, shopId)}>ホームへ</Link>
            </Button>
          </div>
        </UserSectionCard>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <UserSectionCard title="PayPay決済を確定できませんでした" subtitle="もう一度お試しください。">
        <div className="px-4 py-6 sm:px-6">
          <p className="text-sm text-destructive">{error || "決済の確定に失敗しました。"}</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="outline" className="min-h-11 w-full rounded-xl sm:w-auto">
              <Link to={buildPathWithShopId(ROUTES.userReservationInput, shopId)}>予約入力へ戻る</Link>
            </Button>
            <Button asChild className="min-h-11 w-full rounded-xl sm:w-auto">
              <Link to={buildPathWithShopId(ROUTES.userHome, shopId)}>ホームへ</Link>
            </Button>
          </div>
        </div>
      </UserSectionCard>
    </section>
  )
}
