export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ""

if (import.meta.env.DEV && !API_BASE.trim()) {
  console.warn(
    "[api] VITE_API_BASE_URL 未設定: 相対パス /api を使用します（vite の dev / preview とも proxy で 127.0.0.1:8000 へ転送）。別ポートなら vite.config の target を変更するか VITE_API_BASE_URL を明示してください。",
  )
}
