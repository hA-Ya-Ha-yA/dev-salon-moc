/**
 * 管理者向けの fetch ラッパー。`credentials: 'include'` により
 * `Set-Cookie` で付与された access_token（HttpOnly）が自動送信される。
 */
export { apiFetch } from "@/lib/api"
