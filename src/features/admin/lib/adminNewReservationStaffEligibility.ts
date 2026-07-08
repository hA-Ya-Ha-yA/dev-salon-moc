import type { TrainerShiftRow } from "@/features/admin/api/trainerShiftsApi"
import { hasConfirmedOverlapForAssignee } from "@/features/admin/lib/reservationOverlap"
import { reservationFullyWithinTrainerShifts } from "@/features/admin/lib/reservationShiftCoverage"
import type { Reservation } from "@/features/admin/types/reservation"

/**
 * 新規枠用。既存予約 ID と衝突しないよう除外 ID に使う（実在 ID と重ならない値）。
 */
const NEW_RESERVATION_EXCLUDE_ID = "__new_admin_reservation__"

export type NewReservationStaffBlockReason = "overlap" | "shift"

/**
 * 代理新規予約の候補。`ReservationDetailCard` の担当者変更と同じ判定:
 * - `hasConfirmedOverlapForAssignee`（確定予約との重複）
 * - `reservationFullyWithinTrainerShifts`（シフト枠に開始〜終了が完全に含まれる）
 */
export function computeNewReservationStaffEligibility(
  staffId: string,
  startAtIso: string,
  endAtIso: string,
  reservations: Reservation[],
  shiftRowsForDate: TrainerShiftRow[],
): { ok: boolean; reason?: NewReservationStaffBlockReason } {
  if (
    hasConfirmedOverlapForAssignee(
      reservations,
      staffId,
      startAtIso,
      endAtIso,
      NEW_RESERVATION_EXCLUDE_ID,
    )
  ) {
    return { ok: false, reason: "overlap" }
  }
  if (!reservationFullyWithinTrainerShifts(startAtIso, endAtIso, shiftRowsForDate)) {
    return { ok: false, reason: "shift" }
  }
  return { ok: true }
}
