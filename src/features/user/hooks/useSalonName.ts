import { useEffect, useState } from "react"

import { fetchSalonPage } from "@/features/user/api/userSalonApi"

export function useSalonName(shopId: string | undefined): string {
  const [name, setName] = useState("サロン")

  useEffect(() => {
    if (!shopId) {
      queueMicrotask(() => {
        setName("サロン")
      })
      return
    }
    let mounted = true
    void fetchSalonPage(shopId)
      .then((s) => {
        if (mounted) setName(s.salon_name || "サロン")
      })
      .catch(() => {
        if (mounted) setName("サロン")
      })
    return () => {
      mounted = false
    }
  }, [shopId])

  return name
}
