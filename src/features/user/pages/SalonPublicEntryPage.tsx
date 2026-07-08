import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import { ROUTES } from "@/constants/routes"
import { fetchSalonPage } from "@/features/user/api/userSalonApi"
import { buildPathWithShopId } from "@/features/user/hooks/useShopId"
import { persistShopSlug } from "@/lib/shopSlug"

export function SalonPublicEntryPage() {
  const { shopId, slug } = useParams()
  const navigate = useNavigate()
  const [requestError, setRequestError] = useState("")
  const resolvedSlug = shopId ?? slug
  const error = resolvedSlug ? requestError : "Salon not found."

  useEffect(() => {
    if (!resolvedSlug) return

    let mounted = true
    void fetchSalonPage(resolvedSlug)
      .then(() => {
        if (!mounted) return
        persistShopSlug(resolvedSlug)
        navigate(buildPathWithShopId(ROUTES.userHome, resolvedSlug), { replace: true })
      })
      .catch(() => {
        if (mounted) setRequestError("Salon not found.")
      })

    return () => {
      mounted = false
    }
  }, [navigate, resolvedSlug])

  return (
    <main className="flex min-h-dvh items-center justify-center bg-white px-4">
      <p className={error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
        {error || "Loading..."}
      </p>
    </main>
  )
}
