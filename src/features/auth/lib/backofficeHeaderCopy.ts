import type { AdminRole } from "@/features/auth/api/adminSessionApi"

export type BackofficeHeaderCopy = {
  roleLabel: "ADMIN" | "STAFF"
  screenTitle: "管理者画面" | "スタッフ画面"
}

/** バックオフィス共通ヘッダーの権限ラベル（`AdminLayout` 用） */
export function getBackofficeHeaderCopy(role: AdminRole): BackofficeHeaderCopy {
  if (role === "owner") {
    return { roleLabel: "ADMIN", screenTitle: "管理者画面" }
  }
  return { roleLabel: "STAFF", screenTitle: "スタッフ画面" }
}
