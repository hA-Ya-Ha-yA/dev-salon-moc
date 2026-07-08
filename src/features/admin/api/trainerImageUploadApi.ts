import { ADMIN_TRAINER_PROFILE_IMAGE_UPLOAD_PATH } from "@/constants/adminApi"
import { apiFetch } from "@/lib/api"

export const TRAINER_PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024

export const TRAINER_PROFILE_IMAGE_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif"

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
])

export function validateTrainerProfileImageFile(
  file: File,
): string | null {
  if (!ALLOWED_TYPES.has(file.type)) {
    return "JPEG・PNG・WebP・GIF のいずれかを選択してください"
  }
  if (file.size > TRAINER_PROFILE_IMAGE_MAX_BYTES) {
    return "画像は5MB以下にしてください"
  }
  return null
}

export async function uploadTrainerProfileImage(
  file: File,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const validationError = validateTrainerProfileImageFile(file)
  if (validationError) {
    return { ok: false, message: validationError }
  }

  const body = new FormData()
  body.append("file", file)

  const res = await apiFetch(ADMIN_TRAINER_PROFILE_IMAGE_UPLOAD_PATH, {
    method: "POST",
    body,
  })

  if (!res.ok) {
    let message = "画像のアップロードに失敗しました"
    try {
      const data = (await res.json()) as { detail?: unknown }
      if (typeof data.detail === "string" && data.detail.trim()) {
        message = data.detail.trim()
      }
    } catch {
      /* ignore */
    }
    return { ok: false, message }
  }

  try {
    const data = (await res.json()) as { url?: unknown }
    const url = typeof data.url === "string" ? data.url.trim() : ""
    if (!url) {
      return { ok: false, message: "サーバーから画像URLを取得できませんでした" }
    }
    return { ok: true, url }
  } catch {
    return { ok: false, message: "レスポンスの解析に失敗しました" }
  }
}
