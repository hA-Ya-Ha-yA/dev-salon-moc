import { Link } from "react-router-dom"
import { CalendarClock, ScrollText, Store } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ADMIN_SALON_SETTINGS_NAV_STATE } from "@/features/auth/lib/salonSettingsNavState"
import { ROUTES } from "@/constants/routes"
import { cn } from "@/lib/utils"

const salonSettingItems = [
  {
    key: "profile",
    title: "サロン基本情報",
    description: "サロン名・住所・連絡先・予約ページの表示内容",
    to: ROUTES.adminSalonProfile,
    icon: Store,
    disabled: false,
  },
  {
    key: "business-hours",
    title: "営業時間・定休日",
    description: "曜日ごとの営業時間と個別の休業日",
    to: ROUTES.backofficeSetupBusinessHours,
    icon: CalendarClock,
    disabled: false,
  },
  {
    key: "booking-rules",
    title: "予約ルール",
    description: "予約締切・キャンセル期限・受付可能日数など",
    to: ROUTES.backofficeSetupBookingRules,
    icon: ScrollText,
    disabled: false,
  },
] as const

export function AdminSalonSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">サロン設定</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          サロンの基本情報や営業時間、予約ルールを管理します。
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {salonSettingItems.map((item) => {
          const Icon = item.icon
          return (
            <li key={item.key}>
              <Card
                className={cn(
                  "h-full border-border shadow-xs transition-colors",
                  item.disabled && "bg-muted/30",
                )}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-background",
                        item.disabled && "opacity-60",
                      )}
                    >
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
                  {item.disabled || !item.to ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="rounded-md"
                      disabled
                    >
                      開く（準備中）
                    </Button>
                  ) : (
                    <Button asChild variant="default" size="sm" className="rounded-md">
                      <Link to={item.to} state={ADMIN_SALON_SETTINGS_NAV_STATE}>
                        設定を開く
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
