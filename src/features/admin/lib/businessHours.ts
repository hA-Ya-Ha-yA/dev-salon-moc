import type { BusinessHoursItem } from "@/features/admin/api/adminSettingsApi"
import type { AvailabilitySlot } from "@/features/admin/lib/shiftAvailability"

/** JS `Date.getDay()` (0=日…6=土) → API `day_of_week` (0=月…6=日) */
export function jsDateToApiDayOfWeek(d: Date): number {
  const js = d.getDay()
  return js === 0 ? 6 : js - 1
}

export type BusinessWindowForDay = {
  start: string
  end: string
  isClosed: boolean
}

/**
 * その日の営業時間（`business_hours` の該当曜日）。
 */
export function getBusinessHoursForJsDate(
  items: BusinessHoursItem[],
  day: Date,
): BusinessWindowForDay | null {
  const dow = jsDateToApiDayOfWeek(day)
  const row = items.find((h) => h.day_of_week === dow)
  if (!row) return null
  return {
    start: row.start_time.slice(0, 5),
    end: row.end_time.slice(0, 5),
    isClosed: row.is_closed,
  }
}

export function padTimePart(s: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim())
  if (!m) return "09:00"
  const h = Math.min(23, Math.max(0, Number(m[1])))
  const min = Math.min(59, Math.max(0, Number(m[2])))
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`
}

export function timeToMinutes(t: string): number {
  const p = padTimePart(t).split(":").map(Number)
  return p[0] * 60 + p[1]
}

export function minutesToHHmm(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24
  const m = totalMinutes % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/** シフトの時刻選択の刻み（分） */
export const SHIFT_TIME_STEP_MINUTES = 5

/** HH:mm をシフト選択の刻みに丸める（API と UI の選択肢を一致させる） */
export function roundTimeToShiftStep(
  hhmm: string,
  stepMinutes: number = SHIFT_TIME_STEP_MINUTES,
): string {
  const raw = timeToMinutes(padTimePart(hhmm))
  const rounded = Math.round(raw / stepMinutes) * stepMinutes
  const clamped = Math.min(24 * 60 - 1, Math.max(0, rounded))
  return minutesToHHmm(clamped)
}

/**
 * 営業開始〜終了の範囲で、刻み分ごとの時刻（昇順）。
 * 終了時刻より直前の刻みまで（終了＝勤務開始不可の時刻は含めない）。
 */
export function buildStartTimeOptions(
  bizStart: string,
  bizEnd: string,
  stepMinutes: number = SHIFT_TIME_STEP_MINUTES,
): string[] {
  const a = timeToMinutes(bizStart)
  const b = timeToMinutes(bizEnd)
  const out: string[] = []
  for (let m = a; m <= b - stepMinutes; m += stepMinutes) {
    out.push(minutesToHHmm(m))
  }
  return out
}

/**
 * 開始時刻より後、営業終了まで（刻み分、昇順）。
 */
export function buildEndTimeOptions(
  bizEnd: string,
  startHHmm: string,
  stepMinutes: number = SHIFT_TIME_STEP_MINUTES,
): string[] {
  const be = timeToMinutes(bizEnd)
  const sm = timeToMinutes(startHHmm)
  const minEnd = sm + stepMinutes
  const out: string[] = []
  for (let m = minEnd; m <= be; m += stepMinutes) {
    out.push(minutesToHHmm(m))
  }
  return out
}

/** シフト枠が営業開始・終了の範囲内（境界含む）か */
export function shiftSlotWithinBusinessHours(
  slot: AvailabilitySlot,
  biz: { start: string; end: string },
): boolean {
  const a = timeToMinutes(slot.start)
  const b = timeToMinutes(slot.end)
  const bs = timeToMinutes(biz.start)
  const be = timeToMinutes(biz.end)
  return b > a && a >= bs && b <= be
}
