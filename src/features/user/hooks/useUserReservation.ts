import { useEffect, useState } from "react"

import {
  fetchUserReservationById,
  type UserReservation,
} from "@/features/user/api/userReservationApi"

export function useUserReservation(reservationId: string, shopId: string | undefined) {
  const [reservation, setReservation] = useState<UserReservation | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(reservationId))

  useEffect(() => {
    if (!reservationId.trim()) {
      queueMicrotask(() => {
        setReservation(null)
        setIsLoading(false)
      })
      return
    }
    let mounted = true
    queueMicrotask(() => {
      setIsLoading(true)
      void fetchUserReservationById(reservationId, shopId)
        .then((row) => {
          if (!mounted) return
          setReservation(row)
          setIsLoading(false)
        })
        .catch(() => {
          if (!mounted) return
          setReservation(null)
          setIsLoading(false)
        })
    })
    return () => {
      mounted = false
    }
  }, [reservationId, shopId])

  return { reservation, isLoading }
}
