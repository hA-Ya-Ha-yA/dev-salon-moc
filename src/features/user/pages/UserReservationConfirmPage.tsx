import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  MessageSquare,
  UserRound,
} from "lucide-react"
import { Link, useLocation, useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { ROUTES } from "@/constants/routes"
import {
  createReservationPaymentIntent,
  createUserReservation,
  finalizePaidUserReservation,
  startPayPayCheckout,
  updateUserReservation,
} from "@/features/user/api/userReservationApi"
import {
  UserReservationStripePayment,
  type UserReservationStripePaymentHandle,
} from "@/features/user/components/UserReservationStripePayment"
import { UserConfirmDialog } from "@/features/user/components/UserConfirmDialog"
import { UserSectionCard } from "@/features/user/components/UserSectionCard"
import { USER_PAYMENT_METHODS } from "@/features/user/constants/paymentMethods"
import { buildPathWithShopId, useShopId } from "@/features/user/hooks/useShopId"
import {
  clearReservationUpdateIntent,
  readReservationUpdateIntent,
  usePersistentReservationId,
} from "@/features/user/hooks/usePersistentReservationId"
import { useUserReservation } from "@/features/user/hooks/useUserReservation"
import type { ReservationInputData } from "@/features/user/pages/UserReservationInputPage"
import { addMinutesToTimeString, formatDateLongWithWeekday } from "@/lib/dateFormat"
import { isCompletePhoneSegments, joinPhoneSegments, parsePhoneToSegments } from "@/lib/phone"

function splitFullName(fullName: string): { lastName: string; firstName: string } {
  const trimmed = fullName.trim()
  if (!trimmed) return { lastName: "", firstName: "" }
  const [lastName, ...rest] = trimmed.split(/\s+/)
  return { lastName: lastName ?? "", firstName: rest.join(" ") }
}

export function UserReservationConfirmPage() {
  const shopId = useShopId()
  const location = useLocation()
  const navigate = useNavigate()
  const persistentReservationId = usePersistentReservationId()
  const data = location.state as ReservationInputData | null

  const defaultInput: ReservationInputData = {
    mode: "omakase",
    date: "",
    time: "",
    trainerId: "",
    trainerName: "",
    trainerRating: 0,
    menuName: "",
    fullName: "",
    email: "",
    phone: "",
    note: "",
    paymentMethod: "credit",
    cardNumber: "",
    cardExpiry: "",
    cardCvc: "",
    menuDurationMinutes: null,
    menuPrice: null,
  }

  const [isSubmitted, setIsSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [stripeClientSecret, setStripeClientSecret] = useState("")
  const [stripePublishableKey, setStripePublishableKey] = useState("")
  const [stripeAmountYen, setStripeAmountYen] = useState(0)
  const [isStripeReady, setIsStripeReady] = useState(false)
  /** 料金0円メニュー: Stripe を使わず予約 API のみ */
  const [skipCardPayment, setSkipCardPayment] = useState(false)
  const stripePaymentRef = useRef<UserReservationStripePaymentHandle>(null)

  const hasData = Boolean(data)
  const input: ReservationInputData = data ? { ...defaultInput, ...data } : defaultInput

  const treatAsReservationUpdateFlow =
    input.isUpdatingExistingReservation === true ||
    (input.isUpdatingExistingReservation !== false && readReservationUpdateIntent())
  const effectiveReservationId = (
    input.reservationId?.trim() ||
    (treatAsReservationUpdateFlow ? persistentReservationId : "")
  ).trim()
  const isReservationUpdate = treatAsReservationUpdateFlow && Boolean(effectiveReservationId)
  const returnSearch = input.returnSearch ?? ""
  const lookupTarget = `${buildPathWithShopId(ROUTES.userReservationLookup, shopId)}${returnSearch}`
  const { reservation: currentReservation, isLoading: isCurrentReservationLoading } = useUserReservation(
    isReservationUpdate ? effectiveReservationId : "",
    shopId,
  )
  const isCreditPayment = input.paymentMethod === "credit" && !isReservationUpdate
  const [isUpdateCompleteOpen, setIsUpdateCompleteOpen] = useState(false)

  const menuPrice = input.menuPrice ?? null
  /** 入力画面で free 選択、または 0 円メニュー（API で skip 含む） */
  const isPayAtVenue =
    !isReservationUpdate &&
    (input.paymentMethod === "free" ||
      skipCardPayment ||
      (menuPrice != null && menuPrice <= 0))

  const displayMenuName = input.menuName?.trim() || "未定"
  const menuDurationMinutes = input.menuDurationMinutes ?? null
  const displayPriceYen =
    skipCardPayment ? 0 : stripeAmountYen > 0 ? stripeAmountYen : menuPrice
  const displayPriceText = isPayAtVenue
    ? "現地で決済"
    : displayPriceYen != null
      ? `¥${displayPriceYen.toLocaleString()}`
      : "未定"

  const expectedTimeRange = useMemo(() => {
    if (!input.time) return "未選択"
    if (!menuDurationMinutes || menuDurationMinutes <= 0) return input.time
    return `${input.time}〜${addMinutesToTimeString(input.time, menuDurationMinutes)}`
  }, [input.time, menuDurationMinutes])

  const phoneSegments = useMemo(() => parsePhoneToSegments(input.phone), [input.phone])
  const { lastName, firstName } = splitFullName(input.fullName)

  useEffect(() => {
    if (!hasData) return
    if (!isCreditPayment) return
    let active = true
    queueMicrotask(() => {
      setSkipCardPayment(false)
      setIsStripeReady(false)
      setStripeClientSecret("")
      setStripePublishableKey("")
      setStripeAmountYen(0)
      setSubmitError("")
      void createReservationPaymentIntent({
        shopSlug: shopId,
        menuId: input.menuId,
        mode: input.mode,
        trainerId: input.mode === "nomination" ? input.trainerId || null : null,
        date: input.date,
        time: input.time,
      }).then((result) => {
        if (!active) return
        if (!result.ok) {
          setSubmitError(result.error)
          return
        }
        if ("skipPayment" in result && result.skipPayment) {
          setSkipCardPayment(true)
          setIsStripeReady(true)
          return
        }
        setStripeClientSecret(result.clientSecret)
        setStripePublishableKey(result.publishableKey)
        setStripeAmountYen(result.amountYen)
      })
    })
    return () => {
      active = false
    }
  }, [
    hasData,
    input.date,
    input.menuId,
    input.time,
    input.mode,
    input.trainerId,
    isCreditPayment,
    shopId,
  ])

  async function handleSubmit() {
    if (!hasData) return
    if (isReservationUpdate) {
      if (!effectiveReservationId) {
        setSubmitError("予約IDが見つかりません。")
        return
      }
      setSubmitError("")
      setIsSubmitting(true)
      const result = await updateUserReservation({
        reservationId: effectiveReservationId,
        shopSlug: shopId,
        date: input.date,
        time: input.time,
        mode: input.mode,
        trainerId: input.mode === "nomination" ? input.trainerId || null : null,
        trainerName: input.mode === "nomination" ? input.trainerName || null : null,
        note: currentReservation?.note ?? input.note,
        fullName: currentReservation?.customerName ?? input.fullName,
        email: currentReservation?.customerEmail ?? input.email,
        phone: currentReservation?.customerPhone ?? input.phone,
      })
      if (!result.ok) {
        setSubmitError(result.error)
        setIsSubmitting(false)
        return
      }
      clearReservationUpdateIntent()
      setIsSubmitting(false)
      setIsUpdateCompleteOpen(true)
      return
    }

    const commonPayload = {
      date: input.date,
      time: input.time,
      mode: input.mode,
      trainerId: input.mode === "nomination" ? input.trainerId || null : null,
      trainerName: input.mode === "nomination" ? input.trainerName || null : null,
      note: input.note,
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      preferredMenuId: input.menuId,
      shopSlug: shopId,
      paymentMethod: input.paymentMethod,
    }

    setSubmitError("")
    setIsSubmitting(true)

    if (input.paymentMethod === "credit") {
      if (skipCardPayment) {
        const result = await createUserReservation({
          ...commonPayload,
          paymentMethod: "free",
        })
        if (!result.ok) {
          setSubmitError(result.error)
          setIsSubmitting(false)
          return
        }
      } else {
        if (!stripePaymentRef.current) {
          setSubmitError("お支払いフォームの準備ができていません。")
          setIsSubmitting(false)
          return
        }
        try {
          const paymentIntentId = await stripePaymentRef.current.confirm()
          const paid = await finalizePaidUserReservation({
            ...commonPayload,
            paymentIntentId,
          })
          if (!paid.ok) {
            setSubmitError(paid.error)
            setIsSubmitting(false)
            return
          }
        } catch (error) {
          const message = error instanceof Error && error.message ? error.message : "お支払いに失敗しました。"
          setSubmitError(message)
          setIsSubmitting(false)
          return
        }
      }
    } else if (input.paymentMethod === "paypay") {
      const checkout = await startPayPayCheckout(commonPayload)
      if (!checkout.ok) {
        setSubmitError(checkout.error)
        setIsSubmitting(false)
        return
      }
      window.location.assign(checkout.redirectUrl)
      return
    } else {
      const result = await createUserReservation(commonPayload)
      if (!result.ok) {
        setSubmitError(result.error)
        setIsSubmitting(false)
        return
      }
    }

    clearReservationUpdateIntent()
    setIsSubmitting(false)
    setIsSubmitted(true)
  }

  if (isSubmitted) {
    return (
      <section className="flex flex-col items-center py-16 text-center">
        <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="size-8 text-emerald-600" />
        </div>
        <h2 className="text-xl font-bold text-foreground">
          {isReservationUpdate ? "予約を変更しました" : "予約が完了しました"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {isReservationUpdate ? "予約内容の更新が完了しました。" : "予約が完了しました。"}
        </p>
        <Button asChild size="lg" className="mt-6 rounded-xl">
          <Link to={buildPathWithShopId(ROUTES.userHome, shopId)}>ホームへ</Link>
        </Button>
      </section>
    )
  }

  if (!hasData) {
    return (
      <section className="py-16 text-center">
        <p className="text-sm text-muted-foreground">予約の入力情報が見つかりませんでした。</p>
        <Button asChild variant="outline" size="sm" className="mt-4 rounded-lg">
          <Link to={buildPathWithShopId(ROUTES.userHome, shopId)}>ホームへ戻る</Link>
        </Button>
      </section>
    )
  }

  if (isReservationUpdate && isCurrentReservationLoading) {
    return (
      <section className="py-16 text-center">
        <p className="text-sm text-muted-foreground">変更前の予約情報を読み込み中...</p>
      </section>
    )
  }

  if (isReservationUpdate && !currentReservation) {
    return (
      <section className="py-16 text-center">
        <p className="text-sm text-muted-foreground">変更対象の予約情報が見つかりませんでした。</p>
        <Button asChild variant="outline" size="sm" className="mt-4 rounded-lg">
          <Link to={lookupTarget}>予約照会へ戻る</Link>
        </Button>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <UserSectionCard
        title={isReservationUpdate ? "変更内容の確認" : "予約内容の確認"}
        subtitle={
          isReservationUpdate
            ? "変更前と変更後の内容をご確認のうえ、更新してください。"
            : "内容をご確認のうえ、確定してください。"
        }
      >
        <div className="space-y-1 border-b border-slate-100 px-4 py-4 sm:px-6">
          {isReservationUpdate && currentReservation ? (
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{"変更内容"}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-bold text-foreground">変更前</p>
                  <div className="mt-3 space-y-3 text-sm">
                    <div>
                      <p className="text-[11px] text-muted-foreground">日時</p>
                      <p className="font-semibold text-foreground">
                        {currentReservation.date ? formatDateLongWithWeekday(currentReservation.date) : "未選択"}
                      </p>
                      <p className="text-muted-foreground">{currentReservation.time}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">メニュー</p>
                      <p className="font-semibold text-foreground">{currentReservation.menuName || "未設定"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">担当</p>
                      <p className="font-semibold text-foreground">
                        {currentReservation.trainerName ||
                          (currentReservation.mode === "nomination" ? "未設定" : "おまかせ")}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm font-bold text-foreground">変更後</p>
                  <div className="mt-3 space-y-3 text-sm">
                    <div>
                      <p className="text-[11px] text-muted-foreground">日時</p>
                      <p className="font-semibold text-foreground">
                        {input.date ? formatDateLongWithWeekday(input.date) : "未選択"}
                      </p>
                      <p className="text-muted-foreground">{expectedTimeRange}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">メニュー</p>
                      <p className="font-semibold text-foreground">{currentReservation.menuName || "未設定"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">担当</p>
                      <p className="font-semibold text-foreground">
                        {currentReservation.trainerName ||
                          (currentReservation.mode === "nomination" ? "未設定" : "おまかせ")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{"予約情報"}</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-[11px] text-muted-foreground">{"日付"}</p>
                    <p className="text-sm font-semibold text-foreground">
                      {input.date ? formatDateLongWithWeekday(input.date) : "未選択"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <Clock className="size-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-[11px] text-muted-foreground">{"想定時間"}</p>
                    <p className="text-sm font-semibold text-foreground">{expectedTimeRange}</p>
                  </div>
                </div>
              </div>
              {input.mode === "nomination" ? (
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100">
                    <UserRound className="size-5 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">{"指名トレーナー"}</p>
                    <p className="text-sm font-semibold text-foreground">
                      {input.trainerName?.trim() || "未入力"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-[11px] text-muted-foreground">{"予約モード"}</p>
                    <p className="text-sm font-semibold text-foreground">{"おまかせ"}</p>
                  </div>
                </div>
              )}
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">{"メニュー"}</p>
                    <p className="truncate text-sm font-semibold text-foreground">{displayMenuName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <CreditCard className="size-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-[11px] text-muted-foreground">{"料金"}</p>
                    <p className="text-sm font-semibold text-foreground">{displayPriceText}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {!isReservationUpdate ? (
          <div className="space-y-5 border-b border-slate-100 px-4 py-5 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{"予約者情報"}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-foreground">{"姓"}</p>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-foreground">
                {lastName || "未入力"}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-foreground">{"名"}</p>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-foreground">
                {firstName || "未入力"}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-foreground">{"メールアドレス"}</p>
              <div className="break-all rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-foreground">
                {input.email || "未入力"}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-foreground">{"電話番号"}</p>
              {isCompletePhoneSegments(phoneSegments) ? (
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center text-sm font-semibold text-foreground">
                    {phoneSegments[0]}
                  </div>
                  <span className="text-muted-foreground">-</span>
                  <div className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center text-sm font-semibold text-foreground">
                    {phoneSegments[1]}
                  </div>
                  <span className="text-muted-foreground">-</span>
                  <div className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center text-sm font-semibold text-foreground">
                    {phoneSegments[2]}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-foreground">
                  {joinPhoneSegments(phoneSegments) || "未入力"}
                </div>
              )}
            </div>
          </div>
          </div>
        ) : null}

        {!isReservationUpdate ? (
          <div className="space-y-4 border-b border-slate-100 px-4 py-5 sm:px-6">
          <div className="flex items-center gap-2">
            <MessageSquare className="size-4 text-muted-foreground" />
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {"ご要望・備考"}
            </p>
          </div>
          <div className="min-h-[4.5rem] w-full whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-foreground">
            {input.note?.trim() ? input.note : "（なし）"}
          </div>
          </div>
        ) : null}

        {!isReservationUpdate && !isPayAtVenue ? (
          <div className="space-y-4 border-b border-slate-100 px-4 py-5 sm:px-6">
            <div className="flex items-center gap-2">
              <CreditCard className="size-4 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {"決済方法"}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {USER_PAYMENT_METHODS.map((method) => {
                const isActive = input.paymentMethod === method.id
                const Icon = method.icon
                return (
                  <div
                    key={method.id}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium ${
                      isActive
                        ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                        : "border-slate-200 bg-white text-muted-foreground opacity-60"
                    }`}
                  >
                    <Icon className="size-4" />
                    {method.label}
                  </div>
                )
              })}
            </div>

            {isCreditPayment && !skipCardPayment && stripeClientSecret && stripePublishableKey ? (
              <UserReservationStripePayment
                ref={stripePaymentRef}
                clientSecret={stripeClientSecret}
                publishableKey={stripePublishableKey}
                amountYen={stripeAmountYen}
                onReadyChange={setIsStripeReady}
              />
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-3 px-4 py-5 sm:flex-row sm:px-6">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="min-h-11 w-full rounded-xl sm:w-auto"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="mr-1 size-4" />
            前の画面へ戻る
          </Button>
          <Button
            type="button"
            size="lg"
            className="min-h-11 w-full rounded-xl text-base sm:flex-1"
            onClick={() => {
              void handleSubmit()
            }}
            disabled={
              isSubmitting ||
              (isCreditPayment &&
                menuPrice != null &&
                menuPrice <= 0 &&
                !skipCardPayment) ||
              (isCreditPayment && !isPayAtVenue && !isStripeReady)
            }
          >
            {isSubmitting ? "送信中..." : isReservationUpdate ? "予約を変更する" : "予約を確定する"}
          </Button>
        </div>
        {submitError ? (
          <p className="px-4 pb-5 text-sm text-destructive sm:px-6">{submitError}</p>
        ) : null}
      </UserSectionCard>
      <UserConfirmDialog
        open={isUpdateCompleteOpen}
        title="変更が完了しました"
        description="予約内容の更新が完了しました。"
        onCancel={() => {
          setIsUpdateCompleteOpen(false)
          navigate(lookupTarget)
        }}
        onConfirm={async () => {
          setIsUpdateCompleteOpen(false)
          navigate(lookupTarget)
        }}
        confirmLabel="予約照会へ戻る"
        showCancelButton={false}
      />
    </section>
  )
}
