import { useEffect, useState } from "react"

import {
  fetchCustomerBookingRules,
  type CustomerBookingRules,
} from "@/features/user/api/userReservationApi"

const DEFAULT_BOOKING_RULES: CustomerBookingRules = {
  allowSameDay: false,
  bookingDeadlineMinutes: 120,
  cancellationDeadlineHours: 24,
  maxAdvanceDays: 60,
}

export function useCustomerBookingRules(shopSlug?: string) {
  const [bookingRules, setBookingRules] = useState<CustomerBookingRules>(DEFAULT_BOOKING_RULES)

  useEffect(() => {
    let mounted = true
    void fetchCustomerBookingRules(shopSlug)
      .then((rules) => {
        if (!mounted) return
        setBookingRules(rules)
      })
      .catch(() => {
        if (!mounted) return
      })

    return () => {
      mounted = false
    }
  }, [shopSlug])

  return bookingRules
}
