import type { AdminMeProfile } from "@/features/auth/api/adminSessionApi"
import type { Staff } from "@/features/admin/types/staff"

/**
 * シフト編集可否。owner は全スタッフ分を編集可。staff は参照のみ（一切編集不可）。
 */
export function isShiftEditableForStaff(profile: AdminMeProfile, _staff: Staff): boolean {
  return profile.role === "owner"
}

export function filterEditableStaff(
  staffList: Staff[],
  profile: AdminMeProfile,
): Staff[] {
  return staffList.filter((s) => isShiftEditableForStaff(profile, s))
}
