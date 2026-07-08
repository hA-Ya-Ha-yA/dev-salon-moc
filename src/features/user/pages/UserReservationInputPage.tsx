import { type FormEvent, useEffect, useMemo, useRef, useState } from "react"
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  MessageSquare,
  UserRound,
} from "lucide-react"
import { Link, useLocation, useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ROUTES } from "@/constants/routes"
import {
  createReservationPaymentIntent,
  createUserReservation,
  fetchMenuForReservationCheckout,
  finalizePaidUserReservation,
  startPayPayCheckout,
  type ReservationCheckoutMenu,
} from "@/features/user/api/userReservationApi"
import { fetchSalonPage } from "@/features/user/api/userSalonApi"
import { UserConfirmDialog } from "@/features/user/components/UserConfirmDialog"
import {
  UserReservationStripePayment,
  type UserReservationStripePaymentHandle,
} from "@/features/user/components/UserReservationStripePayment"
import { UserSectionCard } from "@/features/user/components/UserSectionCard"
import { USER_PAYMENT_METHODS } from "@/features/user/constants/paymentMethods"
import { buildPathWithShopId, useShopId } from "@/features/user/hooks/useShopId"
import {
  clearReservationUpdateIntent,
  usePersistentReservationId,
} from "@/features/user/hooks/usePersistentReservationId"
import { useUserTrainers } from "@/features/user/hooks/useUserTrainers"
import { addMinutesToTimeString, formatDateLongWithWeekday } from "@/lib/dateFormat"
import {
  isCompletePhoneSegments,
  joinPhoneSegments,
  updatePhoneSegment,
  type PhoneSegments,
} from "@/lib/phone"

export interface ReservationInputData {
  reservationId?: string
  returnSearch?: string
  isUpdatingExistingReservation?: boolean
  mode: string
  date: string
  time: string
  trainerId: string
  trainerName: string
  trainerRating: number
  menuId?: string
  menuName: string
  fullName: string
  email: string
  phone: string
  note: string
  paymentMethod: string
  cardNumber: string
  cardExpiry: string
  cardCvc: string
  /** 確認画面の「想定時間」「料金」表示用（入力時点のメニュー情報） */
  menuDurationMinutes?: number | null
  menuPrice?: number | null
}

export function UserReservationInputPage() {
  type ConfirmDialogStep = "summary" | "card"

  const shopId = useShopId()
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state as {
    mode?: string
    trainerId?: string
    trainerName?: string
    reservationId?: string
    returnSearch?: string
    isUpdatingExistingReservation?: boolean
    date?: string
    time?: string
    preferredMenuId?: string
    preferredMenuName?: string
  } | null) ?? null
  const mode = state?.mode ?? "omakase"
  const trainerId = state?.trainerId ?? ""
  const trainerName = state?.trainerName ?? ""
  const isUpdateFlow = state?.isUpdatingExistingReservation === true
  const stateReservationId = (state?.reservationId ?? "").trim()
  const returnSearch = state?.returnSearch ?? ""
  const persistentReservationId = usePersistentReservationId()
  const reservationId = isUpdateFlow
    ? (stateReservationId || persistentReservationId).trim()
    : ""
  const date = state?.date ?? ""
  const time = state?.time ?? ""
  const preferredMenuId = state?.preferredMenuId ?? ""
  const preferredMenuName = state?.preferredMenuName ?? ""
  const [resolvedMenu, setResolvedMenu] = useState<ReservationCheckoutMenu | null>(null)
  const [resolvedMenuLoading, setResolvedMenuLoading] = useState(true)
  const [stripeConnectReady, setStripeConnectReady] = useState<boolean | null>(null)

  const [paymentMethod, setPaymentMethod] = useState<string>("credit")
  const [creditFlowError, setCreditFlowError] = useState("")
  const [lastName, setLastName] = useState("")
  const [firstName, setFirstName] = useState("")
  const [email, setEmail] = useState("")
  const [phoneSegments, setPhoneSegments] = useState<PhoneSegments>(["", "", ""])
  const [phoneError, setPhoneError] = useState("")
  const [note, setNote] = useState("")
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false)
  const [confirmDialogStep, setConfirmDialogStep] = useState<ConfirmDialogStep>("summary")
  const [reviewData, setReviewData] = useState<ReservationInputData | null>(null)
  const [stripeClientSecret, setStripeClientSecret] = useState("")
  const [stripePublishableKey, setStripePublishableKey] = useState("")
  const [stripeAmountYen, setStripeAmountYen] = useState(0)
  const [skipCardPaymentInline, setSkipCardPaymentInline] = useState(false)
  const [stripeInitError, setStripeInitError] = useState("")
  const [isStripeReady, setIsStripeReady] = useState(false)
  const [finalSubmitError, setFinalSubmitError] = useState("")
  const [isSubmittingFinal, setIsSubmittingFinal] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const stripePaymentRef = useRef<UserReservationStripePaymentHandle>(null)
  const { trainers } = useUserTrainers(shopId)
  const selectedTrainer =
    mode === "nomination" ? trainers.find((trainer) => trainer.id === trainerId) : undefined
  const displayMenuName =
    mode === "nomination" ? preferredMenuName || resolvedMenu?.name || "未定" : resolvedMenu?.name ?? "未定"
  const isZeroPriceMenu = resolvedMenu !== null && resolvedMenu.price <= 0
  const creditPaymentAvailable = stripeConnectReady !== false
  const expectedTimeRange = useMemo(() => {
    if (!time) return "未選択"
    const minutes = resolvedMenu?.duration_minutes
    if (!minutes || minutes <= 0) return time
    return `${time}〜${addMinutesToTimeString(time, minutes)}`
  }, [time, resolvedMenu?.duration_minutes])

  const showInlineStripe =
    !isUpdateFlow &&
    paymentMethod === "credit" &&
    !isZeroPriceMenu &&
    creditPaymentAvailable
  const shouldRenderPersistentStripe =
    showInlineStripe &&
    !skipCardPaymentInline &&
    Boolean(stripeClientSecret && stripePublishableKey)

  useEffect(() => {
    let mounted = true
    if (!shopId?.trim()) {
      queueMicrotask(() => {
        if (mounted) setStripeConnectReady(null)
      })
      return
    }
    void fetchSalonPage(shopId)
      .then((page) => {
        if (!mounted) return
        setStripeConnectReady(page.stripe_connect_connected)
        if (!page.stripe_connect_connected) {
          setPaymentMethod((current) => (current === "credit" ? "paypay" : current))
        }
      })
      .catch(() => {
        if (mounted) setStripeConnectReady(null)
      })
    return () => {
      mounted = false
    }
  }, [shopId])

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (!active) return
      if (isUpdateFlow || !showInlineStripe) {
        setStripeClientSecret("")
        setStripePublishableKey("")
        setStripeAmountYen(0)
        setSkipCardPaymentInline(false)
        setIsStripeReady(false)
        setStripeInitError("")
        return
      }
      if (!resolvedMenu || !date || !time || !shopId?.trim()) {
        return
      }
      setStripeInitError("")
      setIsStripeReady(false)
      setStripeClientSecret("")
      setStripePublishableKey("")
      setStripeAmountYen(0)
      setSkipCardPaymentInline(false)
      void createReservationPaymentIntent({
        shopSlug: shopId,
        menuId: resolvedMenu.menu_id,
        mode,
        trainerId: mode === "nomination" ? trainerId || null : null,
        date,
        time,
      }).then((result) => {
        if (!active) return
        if (!result.ok) {
          setStripeInitError(result.error)
          return
        }
        if ("skipPayment" in result && result.skipPayment) {
          setSkipCardPaymentInline(true)
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
    isUpdateFlow,
    showInlineStripe,
    creditPaymentAvailable,
    resolvedMenu,
    date,
    time,
    shopId,
    mode,
    trainerId,
  ])

  useEffect(() => {
    queueMicrotask(() => {
      setCreditFlowError("")
    })
  }, [paymentMethod])

  useEffect(() => {
    let isMounted = true
    queueMicrotask(() => {
      if (!isMounted) return
      if (!shopId?.trim()) {
        setResolvedMenu(null)
        setResolvedMenuLoading(false)
        return
      }
      setResolvedMenuLoading(true)
      void fetchMenuForReservationCheckout({
        shopSlug: shopId,
        preferredMenuId: preferredMenuId || undefined,
        mode,
        trainerId: mode === "nomination" ? trainerId || null : null,
      })
        .then((menu) => {
          if (!isMounted) return
          setResolvedMenu(menu)
        })
        .catch(() => {
          if (!isMounted) return
          setResolvedMenu(null)
        })
        .finally(() => {
          if (!isMounted) return
          setResolvedMenuLoading(false)
        })
    })
    return () => {
      isMounted = false
    }
  }, [shopId, preferredMenuId, mode, trainerId])

  function buildInputData(): ReservationInputData | null {
    if (!resolvedMenu) return null
    const zeroPrice = resolvedMenu.price <= 0
    const fullName = `${lastName} ${firstName}`.trim()
    const phone = joinPhoneSegments(phoneSegments)
    const isNomination = mode === "nomination"
    const selectedMenuName = isNomination ? preferredMenuName || resolvedMenu.name : resolvedMenu.name
    return {
      ...(isUpdateFlow && reservationId ? { reservationId } : {}),
      ...(returnSearch ? { returnSearch } : {}),
      isUpdatingExistingReservation: isUpdateFlow,
      mode,
      date,
      time,
      trainerId: trainerId || selectedTrainer?.id || "",
      trainerName: trainerName || selectedTrainer?.name || "",
      trainerRating: selectedTrainer?.rating ?? 0,
      menuId: resolvedMenu.menu_id,
      menuName: selectedMenuName,
      fullName,
      email,
      phone,
      note,
      paymentMethod: zeroPrice ? "free" : paymentMethod,
      cardNumber: "",
      cardExpiry: "",
      cardCvc: "",
      menuDurationMinutes: resolvedMenu.duration_minutes,
      menuPrice: resolvedMenu.price,
    }
  }

  function handleGoReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!isCompletePhoneSegments(phoneSegments)) {
      setPhoneError("電話番号は数字のみで3-4-4桁を入力してください。")
      return
    }
    setPhoneError("")
    setCreditFlowError("")

    if (!resolvedMenu) {
      setCreditFlowError("メニュー情報を取得できませんでした。しばらくしてから再度お試しください。")
      return
    }

    const inputData = buildInputData()
    if (!inputData) return

    setReviewData(inputData)
    setConfirmDialogStep("summary")
    setFinalSubmitError("")
    setIsConfirmDialogOpen(true)
  }

  async function handleFinalSubmit() {
    if (!reviewData || !shopId?.trim()) return
    setFinalSubmitError("")
    setIsSubmittingFinal(true)

    const commonPayload = {
      date: reviewData.date,
      time: reviewData.time,
      mode: reviewData.mode,
      trainerId: reviewData.mode === "nomination" ? reviewData.trainerId || null : null,
      trainerName: reviewData.mode === "nomination" ? reviewData.trainerName || null : null,
      note: reviewData.note,
      fullName: reviewData.fullName,
      email: reviewData.email,
      phone: reviewData.phone,
      preferredMenuId: reviewData.menuId,
      shopSlug: shopId,
      paymentMethod: reviewData.paymentMethod,
    }

    try {
      if (reviewData.paymentMethod === "credit") {
        if (skipCardPaymentInline) {
          const result = await createUserReservation({
            ...commonPayload,
            paymentMethod: "free",
          })
          if (!result.ok) {
            setFinalSubmitError(result.error)
            setIsSubmittingFinal(false)
            return
          }
        } else {
          if (!stripePaymentRef.current) {
            setFinalSubmitError("お支払いフォームの準備ができていません。")
            setIsSubmittingFinal(false)
            return
          }
          const paymentIntentId = await stripePaymentRef.current.confirm()
          const paid = await finalizePaidUserReservation({
            ...commonPayload,
            paymentIntentId,
          })
          if (!paid.ok) {
            setFinalSubmitError(paid.error)
            setIsSubmittingFinal(false)
            return
          }
        }
      } else if (reviewData.paymentMethod === "paypay") {
        const checkout = await startPayPayCheckout(commonPayload)
        if (!checkout.ok) {
          setFinalSubmitError(checkout.error)
          setIsSubmittingFinal(false)
          return
        }
        window.location.assign(checkout.redirectUrl)
        return
      } else {
        const result = await createUserReservation(commonPayload)
        if (!result.ok) {
          setFinalSubmitError(result.error)
          setIsSubmittingFinal(false)
          return
        }
      }

      clearReservationUpdateIntent()
      setIsConfirmDialogOpen(false)
      setIsSubmittingFinal(false)
      setIsCompleted(true)
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : "お支払いに失敗しました。"
      setFinalSubmitError(message)
      setIsSubmittingFinal(false)
    }
  }

  async function handleConfirmDialogConfirm() {
    if (!reviewData) return
    if (reviewData.paymentMethod === "credit" && !skipCardPaymentInline && confirmDialogStep === "summary") {
      setFinalSubmitError("")
      setConfirmDialogStep("card")
      return
    }
    await handleFinalSubmit()
  }

  function handleConfirmDialogCancel() {
    if (confirmDialogStep === "card") {
      setConfirmDialogStep("summary")
      setFinalSubmitError("")
      return
    }
    setIsConfirmDialogOpen(false)
    setFinalSubmitError("")
  }

  function handleBack() {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate(buildPathWithShopId(ROUTES.userHome, shopId))
  }

  const reviewExpectedTimeRange = useMemo(() => {
    if (!reviewData?.time) return "未選択"
    const minutes = reviewData.menuDurationMinutes
    if (!minutes || minutes <= 0) return reviewData.time
    return `${reviewData.time}〜${addMinutesToTimeString(reviewData.time, minutes)}`
  }, [reviewData])

  const reviewDisplayPriceText = useMemo(() => {
    if (!reviewData) return "未定"
    if (reviewData.paymentMethod === "free" || skipCardPaymentInline) return "現地で決済"
    if (stripeAmountYen > 0) return `¥${stripeAmountYen.toLocaleString()}`
    if (reviewData.menuPrice != null) return `¥${reviewData.menuPrice.toLocaleString()}`
    return "未定"
  }, [reviewData, skipCardPaymentInline, stripeAmountYen])

  const confirmButtonDisabled =
    resolvedMenuLoading ||
    !resolvedMenu

  if (isCompleted) {
    return (
      <section className="flex flex-col items-center py-16 text-center">
        <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="size-8 text-emerald-600" />
        </div>
        <h2 className="text-xl font-bold text-foreground">予約が完了しました</h2>
        <p className="mt-2 text-sm text-muted-foreground">予約が完了しました。</p>
        <Button asChild size="lg" className="mt-6 rounded-xl">
          <Link to={buildPathWithShopId(ROUTES.userHome, shopId)}>ホームへ</Link>
        </Button>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <UserSectionCard
        title="予約情報入力"
        subtitle="予約に必要な情報を入力してください。"
      >
        <div className="space-y-1 border-b border-slate-100 px-4 py-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {"予約情報"}
            </p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-[11px] text-muted-foreground">{"日付"}</p>
                  <p className="text-sm font-semibold text-foreground">
                    {date ? formatDateLongWithWeekday(date) : "未選択"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <Clock className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">{"想定時間"}</p>
                  <p className="break-words text-sm font-semibold text-foreground">{expectedTimeRange}</p>
                </div>
              </div>
            </div>
            {mode === "nomination" ? (
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100">
                  <UserRound className="size-5 text-slate-400" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">{"指名トレーナー"}</p>
                  <p className="text-sm font-semibold text-foreground">
                    {(selectedTrainer?.name ?? trainerName?.trim()) || "一覧の読み込み中"}
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
                  <p className="text-sm font-semibold text-foreground">
                    {resolvedMenuLoading
                      ? "読み込み中…"
                      : isZeroPriceMenu
                        ? "現地で決済"
                        : resolvedMenu != null
                          ? `¥${resolvedMenu.price.toLocaleString()}`
                          : "未定"}
                  </p>
                </div>
              </div>
            </div>
          </div>

        <form id="reservation-input-form" onSubmit={handleGoReview}>
          <div className="space-y-5 border-b border-slate-100 px-4 py-5 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {"予約者情報"}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="lastName">{"姓"}</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  placeholder={"山田"}
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  required
                  className="h-11 rounded-lg"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="firstName">{"名"}</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  placeholder={"太郎"}
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  required
                  className="h-11 rounded-lg"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">{"メールアドレス"}</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="h-11 rounded-lg"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{"電話番号"}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="phone1"
                    type="tel"
                    inputMode="numeric"
                    placeholder="090"
                    value={phoneSegments[0]}
                    onChange={(event) => {
                      setPhoneSegments((prev) => updatePhoneSegment(prev, 0, event.target.value))
                      setPhoneError("")
                    }}
                    required
                    className="h-11 min-w-0 flex-1 rounded-lg text-center"
                  />
                  <span className="text-muted-foreground">-</span>
                  <Input
                    id="phone2"
                    type="tel"
                    inputMode="numeric"
                    placeholder="1234"
                    value={phoneSegments[1]}
                    onChange={(event) => {
                      setPhoneSegments((prev) => updatePhoneSegment(prev, 1, event.target.value))
                      setPhoneError("")
                    }}
                    required
                    className="h-11 min-w-0 flex-1 rounded-lg text-center"
                  />
                  <span className="text-muted-foreground">-</span>
                  <Input
                    id="phone3"
                    type="tel"
                    inputMode="numeric"
                    placeholder="5678"
                    value={phoneSegments[2]}
                    onChange={(event) => {
                      setPhoneSegments((prev) => updatePhoneSegment(prev, 2, event.target.value))
                      setPhoneError("")
                    }}
                    required
                    className="h-11 min-w-0 flex-1 rounded-lg text-center"
                  />
                </div>
                {phoneError ? <p className="text-xs text-destructive">{phoneError}</p> : null}
              </div>
            </div>
          </div>

          <div className="space-y-4 border-b border-slate-100 px-4 py-5 sm:px-6">
            <div className="flex items-center gap-2">
              <MessageSquare className="size-4 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {"ご要望・備考"}
              </p>
            </div>
            <textarea
              name="note"
              rows={3}
              placeholder={"ご要望やアレルギー情報があればご記入ください"}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>

          {!isUpdateFlow && !isZeroPriceMenu ? (
            <div className="space-y-4 border-b border-slate-100 px-4 py-5 sm:px-6">
              <div className="flex items-center gap-2">
                <CreditCard className="size-4 text-muted-foreground" />
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {"決済方法"}
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {USER_PAYMENT_METHODS.map((method) => {
                  const isActive = paymentMethod === method.id
                  const isDisabled = method.id === "credit" && !creditPaymentAvailable
                  const Icon = method.icon
                  return (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => {
                        if (isDisabled) return
                        setPaymentMethod(method.id)
                      }}
                      disabled={isDisabled}
                      className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition ${
                        isActive
                          ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                          : isDisabled
                            ? "cursor-not-allowed border-slate-200 bg-slate-50 text-muted-foreground opacity-70"
                            : "border-slate-200 bg-white text-foreground hover:bg-slate-50"
                      }`}
                    >
                      <Icon className="size-4" />
                      {method.label}
                    </button>
                  )
                })}
              </div>

              {paymentMethod === "credit" && creditFlowError ? (
                <p className="text-xs text-destructive">{creditFlowError}</p>
              ) : null}
              {!creditPaymentAvailable ? (
                <p className="text-xs text-muted-foreground">
                  この店舗では現在クレジットカード決済を利用できません。
                </p>
              ) : null}
            </div>
          ) : null}
          </form>

        <div className="flex flex-col-reverse gap-3 px-4 py-5 sm:flex-row sm:px-6">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="min-h-11 w-full rounded-xl sm:w-auto"
            onClick={handleBack}
          >
            {"前の画面へ戻る"}
          </Button>
          <Button
            type="submit"
            form="reservation-input-form"
            size="lg"
            className="min-h-11 w-full rounded-xl text-base sm:flex-1"
            disabled={confirmButtonDisabled}
          >
            内容を確認する
          </Button>
        </div>
        {finalSubmitError ? (
          <p className="px-4 pb-5 text-sm text-destructive sm:px-6">{finalSubmitError}</p>
        ) : null}
      </UserSectionCard>
      <UserConfirmDialog
        open={isConfirmDialogOpen && reviewData !== null}
        title={confirmDialogStep === "summary" ? "予約内容の確認" : "クレジットカード情報入力"}
        description={
          confirmDialogStep === "summary"
            ? isUpdateFlow
              ? "変更内容をご確認のうえ、更新してください。"
              : "日付・時間・料金をご確認のうえ、決済へ進んでください。"
            : "カード情報を入力して予約を確定してください。"
        }
        content={
          reviewData ? (
            confirmDialogStep === "summary" ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] text-muted-foreground">日付</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {reviewData.date ? formatDateLongWithWeekday(reviewData.date) : "未選択"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] text-muted-foreground">時間</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{reviewExpectedTimeRange}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] text-muted-foreground">料金</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{reviewDisplayPriceText}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] text-muted-foreground">決済方法</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {reviewData.paymentMethod === "credit"
                      ? "クレジットカード"
                      : reviewData.paymentMethod === "paypay"
                        ? "PayPay"
                        : reviewData.paymentMethod === "free"
                          ? "現地で決済"
                          : reviewData.paymentMethod || "未選択"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {showInlineStripe && (!date || !time) ? (
                  <p className="text-xs text-muted-foreground">
                    カード入力欄は日時選択後に表示されます。先に日付と時間を選択してください。
                  </p>
                ) : null}
                {showInlineStripe && !resolvedMenu && !resolvedMenuLoading ? (
                  <p className="text-xs text-destructive">
                    メニュー情報を取得できないため、カード入力欄を表示できません。
                  </p>
                ) : null}
                {showInlineStripe && stripeInitError ? (
                  <p className="text-xs text-destructive">{stripeInitError}</p>
                ) : null}
                {showInlineStripe &&
                !skipCardPaymentInline &&
                !stripeClientSecret &&
                !stripeInitError &&
                resolvedMenuLoading ? (
                  <p className="text-sm text-muted-foreground">メニュー情報を読み込んでいます...</p>
                ) : null}
                {showInlineStripe &&
                !skipCardPaymentInline &&
                !stripeClientSecret &&
                !stripeInitError &&
                resolvedMenu &&
                date &&
                time &&
                !resolvedMenuLoading ? (
                  <p className="text-sm text-muted-foreground">決済フォームを準備しています...</p>
                ) : null}
                {shouldRenderPersistentStripe ? (
                  <UserReservationStripePayment
                    ref={stripePaymentRef}
                    clientSecret={stripeClientSecret}
                    publishableKey={stripePublishableKey}
                    amountYen={stripeAmountYen}
                    onReadyChange={setIsStripeReady}
                  />
                ) : null}
              </div>
            )
          ) : null
        }
        onCancel={handleConfirmDialogCancel}
        onConfirm={() => {
          void handleConfirmDialogConfirm()
        }}
        confirmLabel={
          confirmDialogStep === "summary"
            ? reviewData?.paymentMethod === "credit" || reviewData?.paymentMethod === "paypay"
              ? "決済へ"
              : isUpdateFlow
                ? "更新する"
                : "予約を確定する"
            : "予約を確定する"
        }
        cancelLabel={confirmDialogStep === "card" ? "内容確認へ戻る" : "キャンセル"}
        isConfirming={isSubmittingFinal}
        confirmDisabled={
          isSubmittingFinal ||
          (confirmDialogStep === "card" &&
            reviewData?.paymentMethod === "credit" &&
            !skipCardPaymentInline &&
            (!stripeClientSecret || !stripePublishableKey || !isStripeReady))
        }
        errorMessage={finalSubmitError || undefined}
      />
    </section>
  )
}
