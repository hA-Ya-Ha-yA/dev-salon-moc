import { AdminPayPaySettingsCard } from "@/features/admin/components/AdminPayPaySettingsCard"
import { AdminStripeConnectCard } from "@/features/admin/components/AdminStripeConnectCard"

export function AdminPaymentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">決済連携</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          クレジットカードとPayPayの売上受取設定を管理します。
        </p>
      </div>

      <AdminStripeConnectCard />
      <AdminPayPaySettingsCard />
    </div>
  )
}
