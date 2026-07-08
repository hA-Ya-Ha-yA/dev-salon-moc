import { useEffect, useState } from "react"

import { fetchUserDashboardSummary } from "@/features/user/api/userDashboardApi"
import type { UserDashboardSummary } from "@/features/user/types/userDashboard"

export function useUserDashboardSummary(shopId?: string) {
  const [summary, setSummary] = useState<UserDashboardSummary | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    let mounted = true

    void fetchUserDashboardSummary(shopId)
      .then((data) => {
        if (!mounted) return
        setError("")
        setSummary(data)
      })
      .catch(() => {
        if (!mounted) return
        setError("店舗情報の取得に失敗しました。")
      })

    return () => {
      mounted = false
    }
  }, [shopId])

  return { summary, error }
}
