import { reservationBelongsToTrainer } from "@/features/admin/api/reservationsApi"
import { padTimePart, timeToMinutes } from "@/features/admin/lib/businessHours"
import {
  getReservationsForDay,
  isoToMinutesInAdminCalendarTz,
} from "@/features/admin/lib/calendarUtils"
import type { Reservation } from "@/features/admin/types/reservation"

function isReservationBlockingShiftPolicy(r: Reservation, staffId: string): boolean {
  if (!reservationBelongsToTrainer(r, staffId)) return false
  if (r.status === "COMPLETED" || r.status === "CANCELLED") return false
  return true
}

/**
 * シフトを削除（休み）にした場合に問題となる、その日・担当者の予約。
 * 確定・未出席など（完了・キャンセル以外）が1件でもあれば休みにできない。
 */
export function getReservationsBlockingShiftRemoval(
  reservations: Reservation[],
  staffId: string,
  day: Date,
): Reservation[] {
  const dayRes = getReservationsForDay(reservations, day)
  return dayRes.filter((r) => isReservationBlockingShiftPolicy(r, staffId))
}

/**
 * 指定シフト [shiftStart, shiftEnd] に対し、その日・担当者の予約のうち
 * シフト時間の外に一部でもはみ出すものを返す（キャンセルは除外）。
 */
export function getReservationsOutsideShiftWindow(
  reservations: Reservation[],
  staffId: string,
  day: Date,
  shiftStartHHmm: string,
  shiftEndHHmm: string,
): Reservation[] {
  const startM = timeToMinutes(padTimePart(shiftStartHHmm))
  const endM = timeToMinutes(padTimePart(shiftEndHHmm))
  const dayRes = getReservationsForDay(reservations, day)

  return dayRes.filter((r) => {
    if (!isReservationBlockingShiftPolicy(r, staffId)) return false
    const rs = isoToMinutesInAdminCalendarTz(r.startAt)
    const re = isoToMinutesInAdminCalendarTz(r.endAt)
    if (re <= rs) {
      return true
    }
    const inside = rs >= startM && re <= endM
    return !inside
  })
}
