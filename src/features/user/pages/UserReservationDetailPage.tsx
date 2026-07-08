import { useEffect, useMemo, useState } from "react"
import { CalendarDays, CreditCard, MessageSquare, Phone, UserRound } from "lucide-react"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { ROUTES } from "@/constants/routes"
import {
  cancelUserReservation,
  evaluateReservationCancellation,
  evaluateReservationUpdate,
  fetchCancellationPolicy,
  fetchReservationChangePolicy,
  formatPaymentStatusLabel,
  formatReservationExpectedTimeRange,
  formatReservationPaymentMethod,
  type CancellationPolicy,
  type ReservationChangePolicy,
  type UserReservation,
} from "@/features/user/api/userReservationApi"
import { UserConfirmDialog } from "@/features/user/components/UserConfirmDialog"
import { UserSectionCard } from "@/features/user/components/UserSectionCard"
import { buildPathWithShopId, useShopId } from "@/features/user/hooks/useShopId"
import { useUserReservation } from "@/features/user/hooks/useUserReservation"
import { formatSlashDateTimeWithWeekday } from "@/lib/dateFormat"

export function UserReservationDetailPage() {
  const { id = "" } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const shopId = useShopId()
  const { reservation, isLoading } = useUserReservation(id, shopId)
  const [reservationOverride, setReservationOverride] = useState<UserReservation | null>(null)
  const [cancellationPolicy, setCancellationPolicy] = useState<CancellationPolicy | null>(null)
  const [changePolicy, setChangePolicy] = useState<ReservationChangePolicy | null>(null)
  const [actionError, setActionError] = useState("")
  const [isCancelling, setIsCancelling] = useState(false)
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false)
  const [isCancelCompleteOpen, setIsCancelCompleteOpen] = useState(false)

  const displayReservation = reservationOverride ?? reservation
  const lookupPath = buildPathWithShopId(ROUTES.userReservationLookup, shopId)
  const lookupTarget = `${lookupPath}${location.search || ""}`

  useEffect(() => {
    let mounted = true
    queueMicrotask(() => {
      void Promise.all([fetchCancellationPolicy(), fetchReservationChangePolicy()])
        .then(([cancellation, change]) => {
          if (!mounted) return
          setCancellationPolicy(cancellation)
          setChangePolicy(change)
        })
        .catch(() => {
          if (!mounted) return
          setCancellationPolicy(null)
          setChangePolicy(null)
        })
    })
    return () => {
      mounted = false
    }
  }, [])

  const cancellationEvaluation = useMemo(() => {
    if (!displayReservation || !cancellationPolicy) return null
    return evaluateReservationCancellation(displayReservation, cancellationPolicy)
  }, [displayReservation, cancellationPolicy])

  const updateEvaluation = useMemo(() => {
    if (!displayReservation || !changePolicy) return null
    return evaluateReservationUpdate(displayReservation, changePolicy)
  }, [displayReservation, changePolicy])

  async function handleCancel() {
    if (!displayReservation) return
    setActionError("")
    setIsCancelling(true)
    const result = await cancelUserReservation(displayReservation.id, shopId)
    setIsCancelling(false)
    if (!result.ok) {
      setActionError(result.error)
      return
    }
    setReservationOverride(result.reservation)
    setIsCancelConfirmOpen(false)
    setIsCancelCompleteOpen(true)
  }

  function handleChange() {
    if (!displayReservation) return
    navigate(buildPathWithShopId(ROUTES.userReservationSchedule, shopId), {
      state: {
        mode: displayReservation.mode,
        trainerId: displayReservation.trainerId ?? "",
        trainerName: displayReservation.trainerName ?? "",
        preferredMenuId: displayReservation.menuId ?? "",
        preferredMenuName: displayReservation.menuName ?? "",
        reservationId: displayReservation.id,
        returnSearch: location.search,
        isUpdatingExistingReservation: true,
      },
    })
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">読み込み中...</p>
  }

  if (!displayReservation) {
    return (
      <section className="space-y-5">
        <UserSectionCard title="予約詳細">
          <div className="p-6">
            <p className="text-sm text-muted-foreground">予約情報を取得できませんでした。</p>
          </div>
        </UserSectionCard>
        <Button asChild variant="outline" size="lg" className="w-full rounded-xl">
          <Link to={lookupTarget}>予約照会へ戻る</Link>
        </Button>
      </section>
    )
  }

  const statusLabel =
    displayReservation.status === "upcoming"
      ? "予約済み"
      : displayReservation.status === "cancelled"
        ? "キャンセル済み"
        : "来店済み"

  return (
    <section className="space-y-5">
      <UserSectionCard title="予約詳細">
        <div className="space-y-4 p-4 sm:p-6">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            変更できるのは日時のみです。指名トレーナーとメニューは変更できません。
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-muted-foreground">予約日時</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {formatSlashDateTimeWithWeekday(displayReservation.date, displayReservation.time)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatReservationExpectedTimeRange(displayReservation.time, displayReservation.serviceEndAt)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-muted-foreground">予約ステータス</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{statusLabel}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
              <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">メニュー</p>
                <p className="break-words text-sm font-semibold text-foreground">{displayReservation.menuName || "未設定"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
              <UserRound className="mt-0.5 size-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">担当</p>
                <p className="text-sm font-semibold text-foreground">
                  {displayReservation.trainerName || (displayReservation.mode === "nomination" ? "未設定" : "おまかせ")}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
              <CreditCard className="mt-0.5 size-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">決済</p>
                <p className="text-sm font-semibold text-foreground">
                  {formatReservationPaymentMethod(displayReservation.paymentMethod)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatPaymentStatusLabel(displayReservation.paymentRecordStatus ?? displayReservation.paymentStatus)}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
              <Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">連絡先</p>
                <p className="break-all text-sm font-semibold text-foreground">
                  {displayReservation.customerEmail || "メール未設定"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{displayReservation.customerPhone || "電話番号未設定"}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-start gap-3">
              <MessageSquare className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">備考</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">
                  {displayReservation.note || "特記事項はありません。"}
                </p>
              </div>
            </div>
          </div>

          {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}
        </div>
      </UserSectionCard>
      <div className="space-y-4">
        {updateEvaluation?.reason ? <p className="text-sm text-muted-foreground">{updateEvaluation.reason}</p> : null}
        {cancellationEvaluation?.reason ? (
          <p className="text-sm text-muted-foreground">{cancellationEvaluation.reason}</p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            type="button"
            size="lg"
            className="w-full rounded-xl"
            onClick={handleChange}
            disabled={!updateEvaluation?.canUpdate}
          >
            変更
          </Button>
          <Button
            type="button"
            size="lg"
            variant="destructive"
            className="w-full rounded-xl"
            onClick={() => {
              setActionError("")
              setIsCancelConfirmOpen(true)
            }}
            disabled={!cancellationEvaluation?.canCancel || isCancelling}
          >
            {isCancelling ? "キャンセル処理中..." : "キャンセル"}
          </Button>
        </div>
        <Button asChild type="button" variant="outline" size="lg" className="w-full rounded-xl">
          <Link to={lookupTarget}>戻る</Link>
        </Button>
      </div>
      <UserConfirmDialog
        open={isCancelConfirmOpen}
        title="予約をキャンセルしますか？"
        description="決済済みの場合は返金処理を行います。"
        onCancel={() => {
          if (isCancelling) return
          setIsCancelConfirmOpen(false)
        }}
        onConfirm={handleCancel}
        confirmLabel="キャンセルする"
        cancelLabel="閉じる"
        isConfirming={isCancelling}
        variant="destructive"
        errorMessage={actionError}
      />
      <UserConfirmDialog
        open={isCancelCompleteOpen}
        title="キャンセルが完了しました"
        description="予約のキャンセル処理が完了しました。"
        onCancel={() => {
          setIsCancelCompleteOpen(false)
          navigate(lookupTarget)
        }}
        onConfirm={async () => {
          setIsCancelCompleteOpen(false)
          navigate(lookupTarget)
        }}
        confirmLabel="予約照会へ戻る"
        showCancelButton={false}
      />
    </section>
  )
}
