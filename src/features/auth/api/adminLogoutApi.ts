import { ADMIN_AUTH_PATHS } from "@/constants/adminApi"
import { apiFetch } from "@/lib/api"

/**
 * Struct `auth.logout` — access_token Cookie を削除。
 */
export async function postAdminLogout(): Promise<boolean> {
  try {
    const res = await apiFetch(ADMIN_AUTH_PATHS.logout, {
      method: "POST",
    })
    return res.ok
  } catch {
    return false
  }
}
