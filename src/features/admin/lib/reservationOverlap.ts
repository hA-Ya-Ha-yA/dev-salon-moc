import type { Reservation } from "@/features/admin/types/reservation"

/** 2つの時間帯が重なるか（端点一致は重ならない扱いにする場合は < を <= に） */
export function reservationIntervalsOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  const s1 = new Date(startA).getTime()
  const e1 = new Date(endA).getTime()
  const s2 = new Date(startB).getTime()
  const e2 = new Date(endB).getTime()
  return s1 < e2 && s2 < e1
}

/**
 * 同一担当者が、指定した時間帯に確定予約を持っているか（自分自身は除外）
 */
export function hasConfirmedOverlapForAssignee(
  reservations: Reservation[],
  assigneeId: string,
  slotStart: string,
  slotEnd: string,
  excludeReservationId: string,
): boolean {
  return reservations.some(
    (r) =>
      r.status === "CONFIRMED" &&
      r.assigneeId === assigneeId &&
      r.id !== excludeReservationId &&
      reservationIntervalsOverlap(slotStart, slotEnd, r.startAt, r.endAt),
  )
}
