import { CalendarDays } from "lucide-react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { ROUTES } from "@/constants/routes"
import { UserSectionCard } from "@/features/user/components/UserSectionCard"
import { usePersistentReservationId } from "@/features/user/hooks/usePersistentReservationId"
import { buildPathWithShopId, useShopId } from "@/features/user/hooks/useShopId"
import { useUserReservation } from "@/features/user/hooks/useUserReservation"
import { formatSlashDateTimeWithWeekday } from "@/lib/dateFormat"

export function UserReservationChangeModePage() {
  const shopId = useShopId()
  const reservationId = usePersistentReservationId()
  const { reservation, isLoading } = useUserReservation(reservationId, shopId)

  const schedulePath = buildPathWithShopId(ROUTES.userReservationSchedule, shopId)

  if (!reservationId) {
    return (
      <section className="space-y-4">
        <div className="rounded-2xl bg-white p-6 shadow-lg">
          <h2 className="text-lg font-bold text-foreground">予約変更</h2>
          <p className="mt-2 text-sm text-muted-foreground">変更対象の予約が見つかりませんでした。</p>
        </div>
        <Button asChild variant="outline" size="lg" className="w-full rounded-xl">
          <Link to={buildPathWithShopId(ROUTES.userHome, shopId)}>ホームへ戻る</Link>
        </Button>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <UserSectionCard title="予約変更" headerTone="plain">

        <div className="space-y-4 p-5">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-semibold text-emerald-700">現在の予約</p>
            {isLoading ? (
              <p className="mt-1 text-sm text-emerald-800">読み込み中...</p>
            ) : reservation ? (
              <div className="mt-2 space-y-2 text-sm text-emerald-800">
                <div className="flex items-start gap-3">
                  <p className="w-20 shrink-0 font-semibold">日時</p>
                  <p>{formatSlashDateTimeWithWeekday(reservation.date, reservation.time)}</p>
                </div>
                <div className="flex items-start gap-3">
                  <p className="w-20 shrink-0 font-semibold">予約方法</p>
                  <p>{reservation.mode === "nomination" ? "指名" : "おまかせ"}</p>
                </div>
                {reservation.mode === "nomination" ? (
                  <div className="flex items-start gap-3">
                    <p className="w-20 shrink-0 font-semibold">トレーナー</p>
                    <p>{reservation.trainerName ?? "トレーナー未設定"}</p>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-1 text-sm text-emerald-800">予約情報を取得できませんでした。</p>
            )}
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            変更できるのは日時のみです。指名トレーナーとメニューは変更できません。
          </div>
          <Button asChild size="lg" className="w-full rounded-xl">
            <Link
              to={schedulePath}
              state={
                reservation
                  ? {
                      mode: reservation.mode,
                      trainerId: reservation.trainerId ?? "",
                      trainerName: reservation.trainerName ?? "",
                      preferredMenuId: reservation.menuId ?? "",
                      preferredMenuName: reservation.menuName ?? "",
                      reservationId,
                      isUpdatingExistingReservation: true,
                    }
                  : undefined
              }
            >
              <CalendarDays className="size-4" />
              日時を変更する
            </Link>
          </Button>
        </div>
      </UserSectionCard>

      <Button asChild variant="outline" size="lg" className="w-full rounded-xl">
        <Link to={buildPathWithShopId(ROUTES.userHome, shopId)}>ホームへ戻る</Link>
      </Button>
    </section>
  )
}
