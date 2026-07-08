import { Link } from "react-router-dom"
import { RefreshCw } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ROUTES } from "@/constants/routes"
import type { Reservation } from "@/features/admin/types/reservation"
import { getReservationAssigneeDisplayName } from "@/features/admin/api/staffApi"
import type { Staff } from "@/features/admin/types/staff"
import {
  ADMIN_CALENDAR_TIME_ZONE,
  formatTime,
  formatDateJaInTimeZone,
} from "@/features/admin/lib/calendarUtils"
import { getReservationTrainerColor } from "@/features/admin/hooks/useStaff"

interface TodayReservationsCardProps {
  reservations: Reservation[]
  staffList: Staff[]
  /** ヘッダー右端に表示（例: 更新日時） */
  updatedAtLabel?: string
  refreshing?: boolean
  onRefresh?: () => void
}

export function TodayReservationsCard({
  reservations,
  staffList,
  updatedAtLabel,
  refreshing = false,
  onRefresh,
}: TodayReservationsCardProps) {
  const todayLabel = formatDateJaInTimeZone(new Date(), ADMIN_CALENDAR_TIME_ZONE)

  const sorted = [...reservations].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
  )

  return (
    <Card className="rounded-lg border-border shadow-xs">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-x-4 gap-y-1 space-y-0 pb-4">
        <div className="min-w-0 space-y-1.5">
          <CardTitle className="text-lg leading-tight">本日の予約一覧</CardTitle>
          <CardDescription>{todayLabel}</CardDescription>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {updatedAtLabel ? (
            <p className="text-right text-sm leading-tight text-muted-foreground/75">
              更新日時
              <br />
              <span className="whitespace-nowrap tabular-nums">{updatedAtLabel}</span>
            </p>
          ) : null}
          {onRefresh ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-md"
              disabled={refreshing}
              onClick={onRefresh}
            >
              <RefreshCw className={`mr-1 size-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "読み込み中..." : "再読み込み"}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">本日の予約はありません。</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sorted.map((r) => {
              const color = getReservationTrainerColor(r, staffList)
              return (
                <li
                  key={r.id}
                  className="flex flex-col gap-2 rounded-lg border border-border border-l-4 py-3 pl-3 pr-3 sm:flex-row sm:items-center sm:justify-between"
                  style={{
                    borderLeftColor: color,
                    backgroundColor: `${color}14`,
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{r.customerName}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatTime(r.startAt)} ～ {formatTime(r.endAt)}
                      <span className="ml-2 inline-flex items-center gap-1">
                        <span
                          className="inline-block size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        担当: {getReservationAssigneeDisplayName(r, staffList)}
                      </span>
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm" className="shrink-0 rounded-md">
                    <Link to={ROUTES.adminReservationDetail.replace(":id", r.id)}>
                      詳細
                    </Link>
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
