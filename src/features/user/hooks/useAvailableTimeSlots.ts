import { useEffect, useState } from "react"

import {
  fetchAvailableTimeSlots,
  type AvailabilityTimeSlot,
} from "@/features/user/api/userReservationApi"

export function useAvailableTimeSlots(
  selectedDate: string,
  shopSlug?: string,
  preferredMenuId?: string,
  trainerId?: string,
  /** 予約変更時: この予約を空き判定から除外し同一枠を選べるようにする */
  excludeReservationId?: string,
) {
  const [availableTimeSlots, setAvailableTimeSlots] = useState<AvailabilityTimeSlot[]>([])

  useEffect(() => {
    let mounted = true
    if (!selectedDate) {
      queueMicrotask(() => {
        if (mounted) setAvailableTimeSlots([])
      })
      return () => {
        mounted = false
      }
    }

    void fetchAvailableTimeSlots(selectedDate, shopSlug, preferredMenuId, trainerId, excludeReservationId)
      .then((slots) => {
        if (!mounted) return
        setAvailableTimeSlots(slots)
      })
      .catch(() => {
        if (!mounted) return
        setAvailableTimeSlots([])
      })

    return () => {
      mounted = false
    }
  }, [selectedDate, shopSlug, preferredMenuId, trainerId, excludeReservationId])

  return availableTimeSlots
}
