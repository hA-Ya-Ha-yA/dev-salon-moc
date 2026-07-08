import { ADMIN_STAFF_INVITATIONS_PATH } from "@/constants/adminApi"
import { apiFetch } from "@/lib/api"

export type StaffInvitationResult =
  | {
      kind: "ok"
      inviteId: string
      email: string
      signupUrl: string
      expiresAt: string
    }
  | { kind: "unauthorized" }
  | { kind: "duplicate"; message: string }
  | { kind: "validation"; message: string }
  | { kind: "error"; message: string }

function readableDetail(raw: unknown): string {
  if (!raw || typeof raw !== "object") return ""
  const detail = (raw as { detail?: unknown; message?: unknown }).detail
  if (typeof detail === "string") return detail
  if (Array.isArray(detail)) {
    for (const item of detail) {
      if (item && typeof item === "object") {
        const msg = (item as { msg?: unknown }).msg
        if (typeof msg === "string" && msg.trim()) return msg
      }
    }
  }
  const message = (raw as { message?: unknown }).message
  return typeof message === "string" ? message : ""
}

function pickString(raw: unknown, ...keys: string[]): string {
  if (!raw || typeof raw !== "object") return ""
  const o = raw as Record<string, unknown>
  const value = keys.map((key) => o[key]).find((v) => typeof v === "string")
  return typeof value === "string" ? value.trim() : ""
}

async function parseJson(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return null
  }
}

export async function postStaffInvitation(payload: {
  email: string
}): Promise<StaffInvitationResult> {
  const email = payload.email.trim().toLowerCase()
  try {
    const res = await apiFetch(ADMIN_STAFF_INVITATIONS_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
    const data = await parseJson(res)
    const message = readableDetail(data)

    if (res.status === 401) return { kind: "unauthorized" }
    if (res.ok) {
      const inviteId = pickString(data, "invite_id", "inviteId")
      const signupUrl = pickString(data, "signup_url", "signupUrl")
      const expiresAt = pickString(data, "expires_at", "expiresAt")
      if (inviteId && signupUrl && expiresAt) {
        return { kind: "ok", inviteId, email, signupUrl, expiresAt }
      }
      return { kind: "error", message: "サーバーから招待情報を取得できませんでした" }
    }
    if (res.status === 409) {
      return {
        kind: "duplicate",
        message: message || "このメールアドレスは既に登録されています",
      }
    }
    if (res.status === 400 || res.status === 422) {
      return { kind: "validation", message: message || "入力内容に誤りがあります" }
    }
    return { kind: "error", message: message || "スタッフ招待メールの送信に失敗しました" }
  } catch {
    return { kind: "error", message: "通信に失敗しました" }
  }
}
