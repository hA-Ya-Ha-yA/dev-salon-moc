import { apiRequest } from "@/lib/apiClient"
import { buildSalonApiPath, resolveShopSlug } from "@/lib/shopSlug"

export interface SalonPageMenu {
  menu_id: string
  name: string
  duration_minutes: number
  price: number
  description: string | null
  image_url: string | null
}

export interface SalonPageResponse {
  salon_name: string
  description: string | null
  address: string | null
  business_hours_summary: string | null
  booking_page_message: string | null
  stripe_connect_connected: boolean
  menus: SalonPageMenu[]
}

export async function fetchSalonPage(shopId?: string): Promise<SalonPageResponse> {
  const resolvedShopSlug = resolveShopSlug(shopId)
  if (!resolvedShopSlug) {
    throw new Error("店舗情報が見つかりません。")
  }
  return apiRequest<SalonPageResponse>(buildSalonApiPath(resolvedShopSlug, ""))
}
