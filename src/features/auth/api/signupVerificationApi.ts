import {
  ADMIN_SIGNUP_VERIFICATIONS_PATH,
  ADMIN_SIGNUP_VERIFICATIONS_VERIFY_PATH,
} from "@/constants/adminApi"
import { apiFetch } from "@/lib/api"

export type SignupVerificationRequestResult =
  | { kind: "ok"; email: string; expiresAt?: number }
  | { kind: "duplicate_email"; message?: string }
  | { kind: "validation"; message?: string }
  | { kind: "error"; status?: number; message?: string }

export type SignupVerificationConsumeResult =
  | { kind: "ok"; email: string }
  | { kind: "expired"; message?: string }
  | { kind: "already_used"; message?: string }
  | { kind: "not_found"; message?: string }
  | { kind: "error"; status?: number; message?: string }

function readableDetail(raw: unknown): string | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const detail = (raw as { detail?: unknown; message?: unknown }).detail
  if (typeof detail === "string" && detail.trim()) return detail
  if (Array.isArray(detail)) {
    for (const item of detail) {
      if (item && typeof item === "object") {
        const msg = (item as { msg?: unknown }).msg
        if (typeof msg === "string" && msg.trim()) return msg
      }
    }
  }
  const message = (raw as { message?: unknown }).message
  if (typeof message === "string" && message.trim()) return message
  return undefined
}

function parseExpiresAt(raw: unknown): number | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const value =
    (raw as { expires_at?: unknown; expiresAt?: unknown }).expires_at ??
    (raw as { expiresAt?: unknown }).expiresAt
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

async function parseJson(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return null
  }
}

export async function requestSignupVerificationEmail(payload: {
  email: string
}): Promise<SignupVerificationRequestResult> {
  const email = payload.email.trim().toLowerCase()
  try {
    const res = await apiFetch(ADMIN_SIGNUP_VERIFICATIONS_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
    const data = await parseJson(res)
    const message = readableDetail(data)

    if (res.ok) return { kind: "ok", email, expiresAt: parseExpiresAt(data) }
    if (res.status === 409) return { kind: "duplicate_email", message }
    if (res.status === 400 || res.status === 422) {
      return { kind: "validation", message }
    }
    return { kind: "error", status: res.status, message }
  } catch {
    return { kind: "error" }
  }
}

export async function verifySignupEmailToken(
  token: string,
): Promise<SignupVerificationConsumeResult> {
  try {
    const res = await apiFetch(ADMIN_SIGNUP_VERIFICATIONS_VERIFY_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
    const data = await parseJson(res)
    const message = readableDetail(data)
    const email =
      data && typeof data === "object" && typeof (data as { email?: unknown }).email === "string"
        ? (data as { email: string }).email
        : ""

    if (res.ok && email) return { kind: "ok", email }
    if (res.status === 404) return { kind: "not_found", message }
    if (res.status === 410) return { kind: "expired", message }
    if (res.status === 409) return { kind: "already_used", message }
    if (res.status === 400 || res.status === 422) return { kind: "not_found", message }
    return { kind: "error", status: res.status, message }
  } catch {
    return { kind: "error" }
  }
}
