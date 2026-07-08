import { ArrowRight, CalendarSearch, Clock3, MapPin, UserRound } from "lucide-react"
import { Link } from "react-router-dom"

import { ROUTES } from "@/constants/routes"
import { buildPathWithShopId } from "@/features/user/hooks/useShopId"
import type { UserDashboardSummary } from "@/features/user/types/userDashboard"

interface UserWelcomeCardProps {
  summary: UserDashboardSummary
  shopId?: string
  reservationId?: string
}

export function UserWelcomeCard({ summary, shopId, reservationId }: UserWelcomeCardProps) {
  const schedulePath = buildPathWithShopId(ROUTES.userReservationSchedule, shopId)
  const lookupPath = buildPathWithShopId(ROUTES.userReservationLookup, shopId)

  return (
    <section className="space-y-6">
      <div className="overflow-hidden rounded-2xl shadow-lg">
        <div className="relative h-72 sm:h-80">
          <img
            src={summary.shopImageUrl}
            alt={summary.shopName}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
          <div className="absolute left-0 right-0 top-0 p-6">
            <h2 className="text-2xl font-bold tracking-tight text-white drop-shadow-md sm:text-3xl">
              {summary.shopName}
            </h2>
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/80">
              {summary.message}
            </p>
          </div>
        </div>

        <div className="grid gap-px bg-slate-200 sm:grid-cols-2">
          <div className="flex items-start gap-3 bg-white p-4">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-cyan-50">
              <MapPin className="size-4 text-cyan-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">所在地</p>
              <p className="mt-1 break-words text-sm leading-snug text-foreground">{summary.shopAddress}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 bg-white p-4">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
              <Clock3 className="size-4 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">営業時間</p>
              <p className="mt-1 break-words text-sm leading-snug text-foreground">
                {summary.businessHours}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white shadow-lg">
        <div className="border-b border-slate-100 px-4 py-5 sm:px-6">
          <h3 className="text-lg font-bold text-foreground">予約メニュー</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            新規予約または既存予約の確認・変更を選択してください。
          </p>
        </div>
        <div className="grid gap-4 p-4 sm:p-6">
          <Link
            to={schedulePath}
            state={
              reservationId
                ? { mode: "nomination", reservationId, isUpdatingExistingReservation: true }
                : { mode: "nomination", isUpdatingExistingReservation: false }
            }
            className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
          >
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-violet-50">
              <UserRound className="size-5 text-violet-600" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground">新規予約</p>
              <p className="mt-0.5 text-xs text-muted-foreground">日時→メニュー→担当スタッフの順で選択します</p>
            </div>
            <ArrowRight className="ml-auto size-4 text-muted-foreground opacity-50 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
          </Link>
          <Link
            to={lookupPath}
            className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
          >
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-amber-50">
              <CalendarSearch className="size-5 text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground">予約確認・変更</p>
              <p className="mt-0.5 text-xs text-muted-foreground">メールアドレスまたは電話番号で予約を確認します</p>
            </div>
            <ArrowRight className="ml-auto size-4 text-muted-foreground opacity-50 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
          </Link>
        </div>
      </div>
    </section>
  )
}
