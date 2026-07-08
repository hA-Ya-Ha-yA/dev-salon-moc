import { useEffect, useState } from "react"

import { fetchUserTrainers, type UserTrainer } from "@/features/user/api/userTrainerApi"

export function useUserTrainers(shopId: string | undefined) {
  const [trainers, setTrainers] = useState<UserTrainer[]>([])

  useEffect(() => {
    if (!shopId) {
      queueMicrotask(() => {
        setTrainers([])
      })
      return
    }
    let mounted = true
    void fetchUserTrainers(shopId)
      .then((rows) => {
        if (mounted) setTrainers(rows)
      })
      .catch(() => {
        if (mounted) setTrainers([])
      })
    return () => {
      mounted = false
    }
  }, [shopId])

  return { trainers }
}
