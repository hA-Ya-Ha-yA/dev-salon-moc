import { useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ROUTES } from "@/constants/routes"
import { postAdminReservationCreate } from "@/features/admin/api/reservationsApi"
import {
  ADMIN_CALENDAR_TIME_ZONE,
  addMinutesToIso,
  combineDateAndTimeToAdminTzIso,
  formatDateJa,
  formatTimeInAdminCalendarTz,
} from "@/features/admin/lib/calendarUtils"
import { isAdminNewReservationDraft } from "@/features/admin/types/adminNewReservation"

function reservationSubmitErrorMessage(e: unknown): string {
  if (e instanceof Error && e.message === "UNAUTHORIZED") {
    return ""
  }
  const msg = e instanceof Error ? e.message : String(e)
  if (!msg.trim()) {
    return "予約の登録に失敗しました。入力内容またはサーバーを確認してください。"
  }
  const fetchFailed = /^FETCH_FAILED:(\d+)$/.exec(msg)
  if (fetchFailed) {
    return `予約の登録に失敗しました（HTTP ${fetchFailed[1]}）。サーバーからの説明文が取得できませんでした。入力内容またはサーバーを確認してください。`
  }
  if (msg === "FETCH_FAILED") {
    return "予約の登録に失敗しました。入力内容またはサーバーを確認してください。"
  }
  return msg
}

export function AdminNewReservationConfirmPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const draft = isAdminNewReservationDraft(location.state) ? location.state : null

  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const startIso = useMemo(() => {
    if (!draft) return null
    return combineDateAndTimeToAdminTzIso(draft.dateYmd, draft.timeHm)
  }, [draft])

  const endIso = useMemo(() => {
    if (!startIso || !draft) return null
    return addMinutesToIso(startIso, draft.durationMinutes)
  }, [startIso, draft])

  useEffect(() => {
    if (!draft) {
      navigate(ROUTES.adminNewReservation, { replace: true })
    }
  }, [draft, navigate])

  if (!draft) {
    return (
      <p className="text-sm text-muted-foreground">入力画面へ移動します…</p>
    )
  }

  const startLabelDate = formatDateJa(new Date(`${draft.dateYmd}T12:00:00+09:00`))
  const startLabelTime = startIso ? formatTimeInAdminCalendarTz(startIso) : "—"
  const endLabelTime = endIso ? formatTimeInAdminCalendarTz(endIso) : "—"

  async function handleFinalize() {
    if (!draft) return
    setSubmitError(null)
    if (!startIso || !endIso) {
      setSubmitError("開始・終了時刻が無効です。入力画面に戻って確認してください。")
      return
    }
    if (new Date(startIso).getTime() <= Date.now()) {
      setSubmitError("開始日時が過去になっています。入力画面でやり直してください。")
      return
    }
    setSubmitting(true)
    try {
      const result = await postAdminReservationCreate({
        menu_id: draft.menuId,
        start_at: startIso,
        end_at: endIso,
        customer_name: draft.customerName,
        customer_email: draft.customerEmail,
        trainer_id: draft.trainerId.trim() ? draft.trainerId.trim() : null,
        customer_id: draft.customerId ?? null,
        customer_phone: draft.customerPhone ?? null,
        notes: draft.notes ?? null,
      })
      if (result?.reservation_id) {
        navigate(
          `/admin/reservations/${encodeURIComponent(result.reservation_id)}`,
          { replace: true },
        )
        return
      }
      navigate(ROUTES.adminCalendar, { replace: true })
    } catch (e) {
      if (e instanceof Error && e.message === "UNAUTHORIZED") {
        navigate(ROUTES.backofficeLogin, { replace: true })
        return
      }
      setSubmitError(reservationSubmitErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">予約内容の確認</h2>
      </div>

      <Card className="border-border shadow-xs">
        <CardHeader>
          <CardTitle className="text-base">入力内容</CardTitle>
          <CardDescription>タイムゾーン: {ADMIN_CALENDAR_TIME_ZONE}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-[8rem_1fr] gap-1">
            <dt className="text-muted-foreground">メニュー</dt>
            <dd>{draft.menuName?.trim() || "—"}</dd>
            <dt className="text-muted-foreground">所要時間</dt>
            <dd>{draft.durationMinutes} 分</dd>
            <dt className="text-muted-foreground">開始</dt>
            <dd>
              {startLabelDate} {startLabelTime}
            </dd>
            <dt className="text-muted-foreground">終了（算出）</dt>
            <dd>
              {startLabelDate} {endLabelTime}
            </dd>
            {draft.trainerId.trim() ? (
              <>
                <dt className="text-muted-foreground">担当</dt>
                <dd>{draft.trainerName ?? draft.trainerId}</dd>
              </>
            ) : null}
            <dt className="text-muted-foreground">顧客名</dt>
            <dd>{draft.customerName}</dd>
            <dt className="text-muted-foreground">メール</dt>
            <dd className="break-all">{draft.customerEmail}</dd>
            {draft.customerPhone ? (
              <>
                <dt className="text-muted-foreground">電話</dt>
                <dd>{draft.customerPhone}</dd>
              </>
            ) : null}
            {draft.notes ? (
              <>
                <dt className="text-muted-foreground">メモ</dt>
                <dd className="whitespace-pre-wrap">{draft.notes}</dd>
              </>
            ) : null}
          </div>

          {submitError ? (
            <p
              className="whitespace-pre-wrap break-words text-sm text-destructive"
              role="alert"
            >
              {submitError}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              type="button"
              className="rounded-md"
              disabled={submitting}
              onClick={() => void handleFinalize()}
            >
              {submitting ? "登録中…" : "予約確定"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="rounded-md"
              disabled={submitting}
              onClick={() => navigate(ROUTES.adminHome)}
            >
              キャンセル
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
