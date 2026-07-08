import { useState } from "react"
import { Link } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ROUTES } from "@/constants/routes"
import { useAdminReservations } from "@/features/admin/context/AdminReservationsContext"
import { useStaff } from "@/features/admin/hooks/useStaff"
import { getReservationAssigneeDisplayName } from "@/features/admin/api/staffApi"
import { formatTime, formatDateJa } from "@/features/admin/lib/calendarUtils"
import { hasConfirmedOverlapForAssignee } from "@/features/admin/lib/reservationOverlap"
import type { Reservation } from "@/features/admin/types/reservation"

export function AdminCancelledListPage() {
  const { cancelledReservations, reservations, loading, updateReservationStatus } =
    useAdminReservations()
  const { staffList } = useStaff()
  const [restoreCandidate, setRestoreCandidate] = useState<Reservation | null>(null)
  const [showOverlapError, setShowOverlapError] = useState(false)

  if (loading) {
    return <p className="text-sm text-muted-foreground">読み込み中...</p>
  }

  const closeRestoreModal = () => setRestoreCandidate(null)

  const handleRestoreConfirm = () => {
    if (!restoreCandidate) return
    const r = restoreCandidate
    const conflict = hasConfirmedOverlapForAssignee(
      reservations,
      r.assigneeId,
      r.startAt,
      r.endAt,
      r.id,
    )
    closeRestoreModal()
    if (conflict) {
      setShowOverlapError(true)
      return
    }
    updateReservationStatus(r.id, "CONFIRMED")
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-lg border-border shadow-xs">
        <CardHeader>
          <CardTitle className="text-lg">キャンセル一覧</CardTitle>
          <CardDescription>
            ステータスを「キャンセル」に変更した予約が表示されます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cancelledReservations.length === 0 ? (
            <p className="text-sm text-muted-foreground">キャンセル済みの予約はありません。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">日付</th>
                    <th className="py-2 pr-4 font-medium">時間</th>
                    <th className="py-2 pr-4 font-medium">お客様名</th>
                    <th className="py-2 pr-4 font-medium">担当者</th>
                    <th className="py-2 pr-4 font-medium" />
                    <th className="py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {cancelledReservations.map((r) => {
                    const d = new Date(r.startAt)
                    return (
                      <tr key={r.id} className="border-b border-border/60">
                        <td className="py-2 pr-4">{formatDateJa(d)}</td>
                        <td className="py-2 pr-4">
                          {formatTime(r.startAt)} ～ {formatTime(r.endAt)}
                        </td>
                        <td className="py-2 pr-4">{r.customerName}</td>
                        <td className="py-2 pr-4">
                          {getReservationAssigneeDisplayName(r, staffList)}
                        </td>
                        <td className="py-2 pr-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="rounded-md"
                            onClick={() => setRestoreCandidate(r)}
                          >
                            確定に復活
                          </Button>
                        </td>
                        <td className="py-2">
                          <Button asChild variant="outline" size="sm" className="rounded-md">
                            <Link to={ROUTES.adminReservationDetail.replace(":id", r.id)}>
                              詳細
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {restoreCandidate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="restore-confirm-title"
          onClick={closeRestoreModal}
        >
          <Card
            className="w-full max-w-md border-border shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <CardTitle id="restore-confirm-title" className="text-base">
                復活の確認
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">この予約を本当に復活させますか？</p>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-md"
                  onClick={closeRestoreModal}
                >
                  いいえ
                </Button>
                <Button
                  type="button"
                  variant="default"
                  className="rounded-md"
                  onClick={handleRestoreConfirm}
                >
                  はい
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showOverlapError && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="overlap-error-title"
          onClick={() => setShowOverlapError(false)}
        >
          <Card
            className="w-full max-w-md border-destructive/50 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <CardTitle id="overlap-error-title" className="text-base text-destructive">
                予約できません
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">
                すでにこの時間帯に予約が入っているため、予約できません。
              </p>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-md"
                  onClick={() => setShowOverlapError(false)}
                >
                  OK
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
