import { useAdminStaff } from "@/features/admin/context/AdminStaffContext"
import type { Reservation } from "@/features/admin/types/reservation"
import type { Staff } from "@/features/admin/types/staff"

export function useStaff() {
  return useAdminStaff()
}

export function getAssigneeColor(assigneeId: string, staffList: Staff[]): string {
  const staff = staffList.find((s) => s.id === assigneeId)
  return staff?.color ?? "#94a3b8"
}

/** トレーナー名からカレンダー・チップ用の安定した色（hex 相当の HSL） */
export function colorFromTrainerName(name: string): string {
  let h = 2166136261
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const hue = (h >>> 0) % 360
  return `hsl(${hue} 55% 42%)`
}

/** 予約の担当（トレーナー）に応じたカレンダー用の色 */
export function getReservationTrainerColor(
  r: Reservation,
  staffList: Staff[],
): string {
  const byId = staffList.find((s) => s.id === r.assigneeId)
  if (byId) return byId.color
  const name = r.trainerName?.trim()
  if (name) {
    const byName = staffList.find((s) => s.name.trim() === name)
    if (byName) return byName.color
    return colorFromTrainerName(name)
  }
  return getAssigneeColor(r.assigneeId, staffList)
}
