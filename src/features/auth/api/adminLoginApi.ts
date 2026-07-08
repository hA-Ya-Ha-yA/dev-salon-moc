import { ADMIN_AUTH_PATHS } from "@/constants/adminApi"
import { generateSalonSlugForSignup } from "@/features/auth/lib/salonSlug"
import { apiFetch } from "@/lib/api"
import type { UserRole } from "@/types"

export type AdminLoginResult = "ok" | "unauthorized" | "error"

export async function postAdminLogin(payload: {
  email: string
  password: string
}): Promise<AdminLoginResult> {
  try {
    const res = await apiFetch(ADMIN_AUTH_PATHS.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: payload.email.trim(),
        password: payload.password,
      }),
    })
    if (res.ok) return "ok"
    if (res.status === 401) return "unauthorized"
    return "error"
  } catch {
    return "error"
  }
}

export async function postAdminLogout(): Promise<void> {
  try {
    await apiFetch(ADMIN_AUTH_PATHS.logout, { method: "POST" })
  } catch {
    // Logout is best-effort; callers should still return to the login page.
  }
}

export type AdminEmailCheckResult =
  | { kind: "available" }
  | { kind: "taken"; message?: string }
  | { kind: "error"; status?: number; message?: string }

function readableDetail(detail: unknown): string | undefined {
  if (typeof detail === "string") return detail
  if (Array.isArray(detail)) {
    for (const item of detail) {
      if (item && typeof item === "object") {
        const message = (item as { msg?: unknown }).msg
        if (typeof message === "string" && message.trim()) return message
      }
    }
  }
  return undefined
}

function detailLooksLikeDuplicate(detail: string): boolean {
  const lower = detail.toLowerCase()
  return (
    lower.includes("duplicate") ||
    lower.includes("already") ||
    lower.includes("exists") ||
    /譌｢縺ｫ|縺吶〒縺ｫ|驥崎､・/.test(detail)
  )
}

function detailLooksLikeMissingSalon(detail: string): boolean {
  return /salon_name|salon|slug|繧ｵ繝ｭ繝ｳ|莠育ｴ・/i.test(detail)
}

export async function checkAdminEmailExists(email: string): Promise<AdminEmailCheckResult> {
  const trimmed = email.trim()
  if (!trimmed) return { kind: "error", message: "Email is required." }
  try {
    const res = await apiFetch(ADMIN_AUTH_PATHS.signup, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: trimmed,
        password: "probe-password-1234",
        name: "probe",
        role: "ADMIN",
      }),
    })

    let detailString: string | undefined
    try {
      const data = (await res.clone().json()) as { detail?: unknown } | null
      detailString = readableDetail(data?.detail)
    } catch {
      // Non-JSON responses are handled by status.
    }

    if (res.status === 409) return { kind: "taken", message: detailString }
    if (res.status === 400) {
      if (detailString && detailLooksLikeDuplicate(detailString)) {
        return { kind: "taken", message: detailString }
      }
      if (detailString && detailLooksLikeMissingSalon(detailString)) {
        return { kind: "available" }
      }
      return { kind: "error", status: 400, message: detailString }
    }
    if (res.ok) return { kind: "error", status: res.status, message: detailString }
    return { kind: "error", status: res.status, message: detailString }
  } catch {
    return { kind: "error" }
  }
}

export type AdminSignupSubmitResult =
  | { kind: "ok" }
  | { kind: "duplicate_email"; message?: string }
  | { kind: "duplicate_slug"; message?: string }
  | { kind: "validation"; message?: string }
  | { kind: "error"; status?: number; message?: string }

type LegacyAdminSignupPayload = {
  email: string
  password: string
  name: string
  role: Exclude<UserRole, "CUSTOMER">
  salonName?: string
  salonSlug?: string
  shopSlug?: string
  inviteToken?: string
}

type InitialSetupSignupPayload = {
  email: string
  password: string
  name: string
  salon_name: string
  salon_slug?: string
}

type LegacyAdminSignupResult = { ok: true } | { ok: false; error: string }

function detailLooksLikeSlugConflict(detail: string): boolean {
  return /slug|繧ｹ繝ｩ繝・げ|莠育ｴ・・繝ｼ繧ｸURL|莠育ｴ・・繝ｼ繧ｸ url/i.test(detail)
}

async function readResponseDetail(res: Response): Promise<string | undefined> {
  try {
    const data = (await res.clone().json()) as { detail?: unknown } | null
    return readableDetail(data?.detail)
  } catch {
    return undefined
  }
}

function legacyErrorFrom(status: number, detail?: string): string {
  if (detail?.trim()) return detail
  if (status === 409) return "Already registered."
  if (status === 400 || status === 422) return "Please check the registration fields."
  return "Registration failed."
}

export function postAdminSignup(payload: LegacyAdminSignupPayload): Promise<LegacyAdminSignupResult>
export function postAdminSignup(payload: InitialSetupSignupPayload): Promise<AdminSignupSubmitResult>
export async function postAdminSignup(
  payload: LegacyAdminSignupPayload | InitialSetupSignupPayload,
): Promise<LegacyAdminSignupResult | AdminSignupSubmitResult> {
  if ("salon_name" in payload) {
    const salonName = payload.salon_name.trim()
    const explicitSlug = payload.salon_slug?.trim().toLowerCase()
    try {
      const maxAttempts = explicitSlug ? 1 : 12
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const salon_slug = explicitSlug ?? generateSalonSlugForSignup(salonName, attempt)
        const res = await apiFetch(ADMIN_AUTH_PATHS.signup, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: payload.email.trim(),
            password: payload.password,
            name: payload.name.trim(),
            role: "ADMIN",
            salon_name: salonName,
            salon_slug,
          }),
        })
        const detailString = await readResponseDetail(res)
        if (res.ok) return { kind: "ok" }
        if (res.status === 409) {
          if (
            !explicitSlug &&
            detailString &&
            detailLooksLikeSlugConflict(detailString) &&
            attempt < maxAttempts - 1
          ) {
            continue
          }
          if (detailString && detailLooksLikeSlugConflict(detailString)) {
            return { kind: "duplicate_slug", message: detailString }
          }
          return { kind: "duplicate_email", message: detailString }
        }
        if (res.status === 400 || res.status === 422) {
          return { kind: "validation", message: detailString }
        }
        return { kind: "error", status: res.status, message: detailString }
      }
      return { kind: "error", message: "Failed to generate a salon slug." }
    } catch {
      return { kind: "error" }
    }
  }

  try {
    const res = await apiFetch(ADMIN_AUTH_PATHS.signup, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: payload.email.trim(),
        password: payload.password,
        name: payload.name.trim(),
        role: payload.role,
        salon_name: payload.salonName?.trim() || undefined,
        salon_slug: payload.salonSlug?.trim().toLowerCase() || undefined,
        shop_slug: payload.shopSlug?.trim().toLowerCase() || undefined,
        invite_token: payload.inviteToken?.trim() || undefined,
      }),
    })
    if (res.ok) return { ok: true }
    return { ok: false, error: legacyErrorFrom(res.status, await readResponseDetail(res)) }
  } catch {
    return { ok: false, error: "Registration failed." }
  }
}
