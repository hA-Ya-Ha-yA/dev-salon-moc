import { useLocation } from "react-router-dom"

import { UserWelcomeCard } from "@/features/user/components/UserWelcomeCard"
import { useShopId } from "@/features/user/hooks/useShopId"
import { useUserDashboardSummary } from "@/features/user/hooks/useUserDashboardSummary"

interface DashboardLocationState {
  reservationId?: string
}

export function UserDashboardPage() {
  const shopId = useShopId()
  const location = useLocation()
  const locationState = (location.state as DashboardLocationState | null) ?? null
  const reservationId = locationState?.reservationId
  const { summary, error } = useUserDashboardSummary(shopId)

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  if (!summary) {
    return <p className="text-sm text-muted-foreground">読み込み中...</p>
  }

  return <UserWelcomeCard summary={summary} shopId={shopId} reservationId={reservationId} />
}
