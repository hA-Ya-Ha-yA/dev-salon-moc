/**
 * 管理者新規登録の「認証メール」用トークン管理。
 *
 * バックエンドに認証メール用 API が無いため、フロント側で 5 分間有効・1 回限り
 * 使えるワンタイムトークンを発行して `localStorage` に保管する。
 * （`localStorage` を使うのは、別タブで認証リンクを開いてもトークンを引ける
 * ようにするため。1 タブに閉じて十分なら sessionStorage でも可。）
 */

import { ROUTES } from "@/constants/routes"

const STORAGE_KEY = "backoffice_signup_verification_v1"
/** 認証リンクの有効期限（ミリ秒）= 5 分 */
export const SIGNUP_VERIFICATION_TTL_MS = 5 * 60 * 1000

export type SignupVerificationRecord = {
  token: string
  email: string
  /** 発行時の Unix ms */
  issuedAt: number
  /** 失効する Unix ms */
  expiresAt: number
  /** 既に消費済みかどうか */
  used: boolean
}

export type ConsumeResult =
  | { kind: "ok"; email: string }
  | { kind: "not_found" }
  | { kind: "expired" }
  | { kind: "already_used" }

function readRaw(): SignupVerificationRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SignupVerificationRecord> | null
    if (!parsed || typeof parsed !== "object") return null
    if (
      typeof parsed.token !== "string" ||
      typeof parsed.email !== "string" ||
      typeof parsed.issuedAt !== "number" ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null
    }
    return {
      token: parsed.token,
      email: parsed.email,
      issuedAt: parsed.issuedAt,
      expiresAt: parsed.expiresAt,
      used: Boolean(parsed.used),
    }
  } catch {
    return null
  }
}

function writeRaw(record: SignupVerificationRecord | null): void {
  try {
    if (record == null) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
    }
  } catch {
    // ストレージが使えない環境では何もしない
  }
}

function generateToken(): string {
  // crypto.randomUUID は IE 以外なら大体使える
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "")
  }
  // フォールバック: Math.random で 32 文字の hex
  let s = ""
  for (let i = 0; i < 32; i += 1) {
    s += Math.floor(Math.random() * 16).toString(16)
  }
  return s
}

/** 新しい認証トークンを発行し localStorage に保存。直前のトークンは破棄される。 */
export function issueSignupVerification(email: string): SignupVerificationRecord {
  const trimmed = email.trim().toLowerCase()
  const now = Date.now()
  const record: SignupVerificationRecord = {
    token: generateToken(),
    email: trimmed,
    issuedAt: now,
    expiresAt: now + SIGNUP_VERIFICATION_TTL_MS,
    used: false,
  }
  writeRaw(record)
  return record
}

/** 現在保存されている発行済みレコードを取得（消費はしない） */
export function peekSignupVerification(): SignupVerificationRecord | null {
  return readRaw()
}

/** 認証リンクを発行（ページ全体の絶対URLを返す） */
export function buildSignupVerificationUrl(token: string): string {
  const path = `${ROUTES.backofficeSignupVerify}?token=${encodeURIComponent(token)}`
  if (typeof window !== "undefined" && window.location) {
    return `${window.location.origin}${path}`
  }
  return path
}

/**
 * トークンを消費する。成功時は email を返し、レコードを削除する。
 * 期限切れ・既使用・存在しない場合はそれぞれの理由を返す。
 */
export function consumeSignupVerification(token: string): ConsumeResult {
  const record = readRaw()
  const now = Date.now()
  if (!record || record.token !== token) return { kind: "not_found" }
  if (record.used) {
    writeRaw(null)
    return { kind: "already_used" }
  }
  if (record.expiresAt <= now) {
    writeRaw(null)
    return { kind: "expired" }
  }
  // 1 回限りの消費
  writeRaw(null)
  return { kind: "ok", email: record.email }
}

/** 単に保存中のレコードを破棄 */
export function clearSignupVerification(): void {
  writeRaw(null)
}
