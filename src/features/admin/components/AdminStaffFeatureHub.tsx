import { Link, useNavigate } from "react-router-dom"
import { CalendarDays, CalendarRange, UserPlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ROUTES } from "@/constants/routes"

const hubItems = [
  {
    key: "calendar",
    title: "予約カレンダー",
    description: "日・週・月単位で予約状況を確認します",
    to: ROUTES.adminCalendar,
    icon: CalendarDays,
    action: "link" as const,
  },
  {
    key: "new-reservation",
    title: "新規予約",
    description: "お客様の代理予約を登録します",
    to: ROUTES.adminNewReservation,
    icon: UserPlus,
    action: "new-reservation" as const,
  },
  {
    key: "shifts",
    title: "シフトカレンダー",
    description: "店舗に所属するスタッフ全員のシフトを確認します",
    to: ROUTES.adminShiftCalendar,
    icon: CalendarRange,
    action: "link" as const,
  },
] as const

export function AdminStaffFeatureHub() {
  const navigate = useNavigate()

  return (
    <section aria-label="スタッフ向け機能" className="space-y-3">
      <div>
        <h2 className="text-base font-semibold tracking-tight">業務メニュー</h2>
        <p className="text-sm text-muted-foreground">各機能を選ぶと該当画面に移動します。</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {hubItems.map((item) => {
          const Icon = item.icon
          return (
            <li key={item.key}>
              <Card className="h-full border-border shadow-xs transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                      <Icon className="size-5 text-foreground" aria-hidden />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <CardTitle className="text-base leading-snug">{item.title}</CardTitle>
                      <CardDescription className="text-xs leading-relaxed">
                        {item.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {item.action === "new-reservation" ? (
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      className="rounded-md"
                      onClick={() =>
                        navigate(ROUTES.adminNewReservation, {
                          state: { bookingNotBeforeIso: new Date().toISOString() },
                        })
                      }
                    >
                      画面を開く
                    </Button>
                  ) : (
                    <Button asChild variant="default" size="sm" className="rounded-md">
                      <Link to={item.to}>画面を開く</Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
