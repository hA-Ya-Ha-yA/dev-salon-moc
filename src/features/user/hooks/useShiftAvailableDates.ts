import { useEffect, useState } from "react"

import { fetchShiftAvailableDates } from "@/features/user/api/userReservationApi"

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function useShiftAvailableDates(
  displayMonth: Date,
  shopSlug?: string,
  preferredMenuId?: string,
  trainerId?: string,
  excludeReservationId?: string,
) {
  const [shiftAvailableDates, setShiftAvailableDates] = useState<string[] | null>(null)

  useEffect(() => {
    let mounted = true
    const fromDate = toDateKey(new Date(displayMonth.getFullYear(), displayMonth.getMonth(), 1))
    const toDate = toDateKey(new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 0))
    queueMicrotask(() => {
      if (mounted) setShiftAvailableDates(null)
    })

    void fetchShiftAvailableDates(
      fromDate,
      toDate,
      shopSlug,
      preferredMenuId,
      trainerId,
      excludeReservationId,
    )
      .then((dates) => {
        if (!mounted) return
        setShiftAvailableDates(dates)
      })
      .catch(() => {
        if (!mounted) return
        setShiftAvailableDates([])
      })

    return () => {
      mounted = false
    }
  }, [displayMonth, shopSlug, preferredMenuId, trainerId, excludeReservationId])

  return shiftAvailableDates
}
