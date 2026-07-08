import { type FormEvent, useCallback, useEffect, useState } from "react"
import { CalendarDays, ChevronRight, Search, SearchX } from "lucide-react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ROUTES } from "@/constants/routes"
import {
  clearReservationLookupToken,
  fetchReservationsByContact,
  formatPaymentStatusLabel,
  formatReservationExpectedTimeRange,
  getReservationLookupToken,
  requestReservationLookupOtp,
  setReservationLookupToken,
  verifyReservationLookupOtp,
  type UserReservation,
} from "@/features/user/api/userReservationApi"
import { UserSectionCard } from "@/features/user/components/UserSectionCard"
import { buildPathWithShopId, useShopId } from "@/features/user/hooks/useShopId"
import { ApiClientError } from "@/lib/apiClient"
import { formatSlashDateTimeWithWeekday } from "@/lib/dateFormat"

export function UserReservationLookupPage() {
  const shopId = useShopId()
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [otpCode, setOtpCode] = useState("")
  const [challengeId, setChallengeId] = useState("")
  const [otpHint, setOtpHint] = useState("")
  const [awaitingOtp, setAwaitingOtp] = useState(false)
  const [lookupVerified, setLookupVerified] = useState(false)
  const [error, setError] = useState("")
  const [reservations, setReservations] = useState<UserReservation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadReservations = useCallback(async () => {
    const token = getReservationLookupToken(shopId)
    if (!token) {
      setLookupVerified(false)
      setReservations([])
      return
    }
    setIsLoading(true)
    setError("")
    try {
      const result = await fetchReservationsByContact({ shopSlug: shopId, lookupToken: token })
      setReservations(result)
      setLookupVerified(true)
    } catch (nextError: unknown) {
      setReservations([])
      const message = nextError instanceof Error ? nextError.message : "予約照会に失敗しました。"
      const isLookupAuthExpired =
        nextError instanceof ApiClientError
          ? nextError.status === 401 || nextError.status === 403
          : message.includes("認証")
      if (isLookupAuthExpired) {
        clearReservationLookupToken(shopId)
        setLookupVerified(false)
        setAwaitingOtp(false)
        setChallengeId("")
        setError("認証の有効期限が切れました。もう一度お試しください。")
      } else {
        setLookupVerified(true)
        setError(message)
      }
    } finally {
      setIsLoading(false)
    }
  }, [shopId])

  useEffect(() => {
    if (getReservationLookupToken(shopId)) {
      void loadReservations()
    }
  }, [loadReservations, shopId])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedEmail = email.trim()
    const normalizedPhone = phone.trim()

    if (!awaitingOtp) {
      if (!normalizedEmail && !normalizedPhone) {
        setError("メールアドレスまたは電話番号を入力してください。")
        return
      }
      if (normalizedEmail && normalizedPhone) {
        setError("メールアドレスと電話番号は同時に入力できません。")
        return
      }
      setIsSubmitting(true)
      setError("")
      setReservations([])
      setLookupVerified(false)
      try {
        const response = await requestReservationLookupOtp({
          shopSlug: shopId,
          email: normalizedEmail || undefined,
          phone: normalizedPhone || undefined,
        })
        setChallengeId(response.challenge_id)
        setOtpHint(
          response.masked_destination && response.masked_destination !== "***"
            ? `${response.masked_destination} 宛に認証コードを送信しました。`
            : response.message,
        )
        setOtpCode("")
        setAwaitingOtp(true)
      } catch (nextError: unknown) {
        setError(nextError instanceof Error ? nextError.message : "認証コードの送信に失敗しました。")
      } finally {
        setIsSubmitting(false)
      }
      return
    }

    const code = otpCode.trim()
    if (code.length !== 6) {
      setError("6桁の認証コードを入力してください。")
      return
    }
    setIsSubmitting(true)
    setError("")
    try {
      const verified = await verifyReservationLookupOtp({
        shopSlug: shopId,
        challengeId,
        code,
      })
      setReservationLookupToken(shopId, verified.lookup_token)
      setAwaitingOtp(false)
      await loadReservations()
    } catch (nextError: unknown) {
      setError(nextError instanceof Error ? nextError.message : "認証に失敗しました。")
    } finally {
      setIsSubmitting(false)
    }
  }

  const detailBasePath = buildPathWithShopId(ROUTES.userReservationDetail, shopId)

  return (
    <section className="space-y-5">
      <UserSectionCard
        title="予約確認・変更"
        subtitle="予約時に入力したメールアドレス、または電話番号で該当予約を検索できます。"
      >
        <form className="space-y-5 p-4 sm:p-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="lookup-email">メールアドレス</Label>
            <Input
              id="lookup-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={awaitingOtp}
              className="h-11 rounded-lg"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lookup-phone">電話番号</Label>
            <Input
              id="lookup-phone"
              type="tel"
              placeholder="09012345678"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              disabled={awaitingOtp}
              className="h-11 rounded-lg"
            />
          </div>
          <p className="text-xs text-muted-foreground">どちらか一方の入力で照会できます。</p>
          {awaitingOtp ? (
            <>
              {otpHint ? <p className="text-xs text-muted-foreground">{otpHint}</p> : null}
              <div className="space-y-2">
                <Label htmlFor="lookup-otp">認証コード（6桁）</Label>
                <Input
                  id="lookup-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="123456"
                  value={otpCode}
                  onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="h-11 rounded-lg"
                />
              </div>
            </>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" size="lg" className="w-full rounded-xl" disabled={isSubmitting}>
            <Search className="size-4" />
            予約を検索する
          </Button>
        </form>
      </UserSectionCard>

      {lookupVerified ? (
        <UserSectionCard title="照会結果">
          <div className="space-y-4 p-4 sm:p-6">
            {isLoading ? <p className="text-sm text-muted-foreground">読み込み中...</p> : null}
            {!isLoading && error ? <p className="text-sm text-destructive">{error}</p> : null}
            {!isLoading && !error && reservations.length === 0 ? (
              <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 px-6 py-12 text-center">
                <SearchX className="size-8 text-slate-300" />
                <p className="mt-3 text-sm font-medium text-foreground">一致する予約は見つかりませんでした。</p>
                <p className="mt-1 text-xs text-muted-foreground">入力内容をご確認のうえ、もう一度お試しください。</p>
              </div>
            ) : null}
            {!isLoading && !error && reservations.length > 0 ? (
              <div className="space-y-3">
                {reservations.map((reservation) => (
                  <Link
                    key={reservation.id}
                    to={detailBasePath.replace(":id", reservation.id)}
                    className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"
                  >
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-slate-100">
                      <CalendarDays className="size-5 text-slate-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        {formatSlashDateTimeWithWeekday(reservation.date, reservation.time)}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {reservation.menuName || "メニュー未設定"} /{" "}
                        {formatReservationExpectedTimeRange(reservation.time, reservation.serviceEndAt)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        ステータス:{" "}
                        {reservation.status === "upcoming"
                          ? "予約済み"
                          : reservation.status === "cancelled"
                            ? "キャンセル済み"
                            : "来店済み"}{" "}
                        / 決済:{" "}
                        {formatPaymentStatusLabel(reservation.paymentRecordStatus ?? reservation.paymentStatus)}
                      </p>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </UserSectionCard>
      ) : null}
    </section>
  )
}
