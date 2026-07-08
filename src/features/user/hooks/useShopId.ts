import { useEffect, useMemo } from "react"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"

import { persistShopSlug, resolveShopSlug } from "@/lib/shopSlug"

export function useShopId(): string | undefined {
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const queryShopId = params.get("shopId") ?? undefined

  useEffect(() => {
    const slug = queryShopId?.trim()
    if (!slug) return
    persistShopSlug(slug)

    const nextParams = new URLSearchParams(location.search)
    nextParams.delete("shopId")
    const nextSearch = nextParams.toString()
    navigate(`${location.pathname}${nextSearch ? `?${nextSearch}` : ""}${location.hash}`, {
      replace: true,
    })
  }, [location.hash, location.pathname, location.search, navigate, queryShopId])

  return useMemo(() => {
    const slug = resolveShopSlug(queryShopId)
    return slug ?? undefined
  }, [queryShopId])
}

export function buildPathWithShopId(path: string, shopId: string | null | undefined): string {
  if (shopId?.trim()) persistShopSlug(shopId)
  return path
}
