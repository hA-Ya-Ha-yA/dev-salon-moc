import { adminTrainerShiftsPath } from "@/constants/adminApi"
import { apiFetch } from "@/lib/api"
import type { BulkMonthPlan } from "@/features/admin/lib/shiftBulkMonth"
import type { AvailabilitySlot } from "@/features/admin/lib/shiftAvailability"
import { minutesToHHmm, roundTimeToShiftStep } from "@/features/admin/lib/businessHours"
import { isoToMinutesInAdminCalendarTz } from "@/features/admin/lib/calendarUtils"

/** `GET /api/admin/trainers/{trainer_id}/shifts` の1行 */
export type TrainerShiftRow = {
  shift_id: string
  trainer_id: string
  date: string
  start_time: string
  end_time: string
}

/**
 * API の `start_time` / `end_time` を `HH:mm` に正規化。
 * - ISO 日時（UTC 等）は管理カレンダーと同じタイムゾーンでの時刻に変換
 * - `HH:MM:SS` / `HH:MM` はそのまま解釈
 * - シフトは5分刻み選択のため、分を刻みに丸める（カレンダー表示と編集 UI を一致させる）
 */
export function normalizeShiftTime(t: string): string {
  const s = String(t).trim()
  let mins: number
  if (s.includes("T") || /^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s)
    if (!Number.isNaN(d.getTime())) {
      mins = isoToMinutesInAdminCalendarTz(s)
    } else {
      mins = 9 * 60
    }
  } else {
    const m = /^(\d{1,2}):(\d{2})/.exec(s)
    if (!m) mins = 9 * 60
    else {
      const h = Math.min(23, Math.max(0, Number(m[1])))
      const min = Math.min(59, Math.max(0, Number(m[2])))
      mins = h * 60 + min
    }
  }
  return roundTimeToShiftStep(minutesToHHmm(mins))
}

/**
 * `GET /api/admin/trainers/{trainer_id}/shifts`
 * `trainer_shifts` を `date_from` / `date_to`（YYYY-MM-DD）で絞り込み。
 */
export async function fetchTrainerShifts(
  trainerId: string,
  range: { dateFrom: string; dateTo: string },
): Promise<TrainerShiftRow[]> {
  const q = new URLSearchParams()
  q.set("date_from", range.dateFrom)
  q.set("date_to", range.dateTo)
  const res = await apiFetch(`${adminTrainerShiftsPath(trainerId)}?${q.toString()}`, {
    method: "GET",
  })
  if (res.status === 401) {
    throw new Error("UNAUTHORIZED")
  }
  if (!res.ok) {
    throw new Error("FETCH_FAILED")
  }
  let data: unknown
  try {
    data = await res.json()
  } catch {
    data = null
  }
  if (!Array.isArray(data)) return []
  const out: TrainerShiftRow[] = []
  for (const row of data) {
    if (!row || typeof row !== "object") continue
    const o = row as Record<string, unknown>
    const shiftId = o.shift_id ?? o.shiftId
    const tid = o.trainer_id ?? o.trainerId
    const dateRaw = o.date
    const st = o.start_time ?? o.startTime
    const et = o.end_time ?? o.endTime
    if (
      shiftId == null ||
      tid == null ||
      typeof dateRaw !== "string" ||
      typeof st !== "string" ||
      typeof et !== "string"
    ) {
      continue
    }
    out.push({
      shift_id: String(shiftId),
      trainer_id: String(tid),
      date: dateRaw.slice(0, 10),
      start_time: st,
      end_time: et,
    })
  }
  return out
}

/** スタッフ・日付ごとに API 行を保持（シフトID付き編集用） */
export function groupTrainerShiftRowsByDate(
  rows: TrainerShiftRow[],
  trainerId: string,
): Record<string, TrainerShiftRow[]> {
  const byDate: Record<string, TrainerShiftRow[]> = {}
  for (const r of rows) {
    if (r.trainer_id !== trainerId) continue
    const dk = r.date.slice(0, 10)
    if (!byDate[dk]) byDate[dk] = []
    byDate[dk].push(r)
  }
  for (const dk of Object.keys(byDate)) {
    byDate[dk].sort((a, b) =>
      normalizeShiftTime(a.start_time).localeCompare(normalizeShiftTime(b.start_time)),
    )
  }
  return byDate
}

export function rowsToSlots(rows: TrainerShiftRow[]): AvailabilitySlot[] {
  return rows.map((r) => ({
    start: normalizeShiftTime(r.start_time),
    end: normalizeShiftTime(r.end_time),
  }))
}

function shiftDetailUrl(trainerId: string, shiftId: string): string {
  return `${adminTrainerShiftsPath(trainerId)}/${encodeURIComponent(shiftId)}`
}

function toApiTime(t: string): string {
  return normalizeShiftTime(t)
}

function parseTrainerShiftOut(data: unknown): TrainerShiftRow {
  if (!data || typeof data !== "object") throw new Error("INVALID_RESPONSE")
  const o = data as Record<string, unknown>
  const shiftId = o.shift_id ?? o.shiftId
  const tid = o.trainer_id ?? o.trainerId
  const dateRaw = o.date
  const st = o.start_time ?? o.startTime
  const et = o.end_time ?? o.endTime
  if (
    shiftId == null ||
    tid == null ||
    typeof dateRaw !== "string" ||
    typeof st !== "string" ||
    typeof et !== "string"
  ) {
    throw new Error("INVALID_RESPONSE")
  }
  return {
    shift_id: String(shiftId),
    trainer_id: String(tid),
    date: dateRaw.slice(0, 10),
    start_time: st,
    end_time: et,
  }
}

/**
 * `POST /api/admin/trainers/{trainer_id}/shifts`
 */
export async function createTrainerShift(
  trainerId: string,
  body: { date: string; start_time: string; end_time: string },
): Promise<TrainerShiftRow> {
  const res = await apiFetch(adminTrainerShiftsPath(trainerId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      date: body.date.slice(0, 10),
      start_time: toApiTime(body.start_time),
      end_time: toApiTime(body.end_time),
    }),
  })
  if (res.status === 401) throw new Error("UNAUTHORIZED")
  if (!res.ok) throw new Error("FETCH_FAILED")
  const data = await res.json()
  return parseTrainerShiftOut(data)
}

/**
 * `PUT /api/admin/trainers/{trainer_id}/shifts/{shift_id}`
 */
export async function updateTrainerShift(
  trainerId: string,
  shiftId: string,
  body: { date: string; start_time: string; end_time: string },
): Promise<void> {
  const res = await apiFetch(shiftDetailUrl(trainerId, shiftId), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      date: body.date.slice(0, 10),
      start_time: toApiTime(body.start_time),
      end_time: toApiTime(body.end_time),
    }),
  })
  if (res.status === 401) throw new Error("UNAUTHORIZED")
  if (!res.ok) throw new Error("FETCH_FAILED")
}

/**
 * `DELETE /api/admin/trainers/{trainer_id}/shifts/{shift_id}`
 */
export async function deleteTrainerShift(trainerId: string, shiftId: string): Promise<void> {
  const res = await apiFetch(shiftDetailUrl(trainerId, shiftId), { method: "DELETE" })
  if (res.status === 401) throw new Error("UNAUTHORIZED")
  if (!res.ok) throw new Error("FETCH_FAILED")
}

/**
 * `POST /api/admin/trainers/{trainer_id}/shifts/bulk` — 複数日のシフトを一括作成。
 */
export async function createTrainerShiftsBulk(
  trainerId: string,
  shifts: { date: string; start_time: string; end_time: string }[],
): Promise<TrainerShiftRow[]> {
  if (shifts.length === 0) return []
  const res = await apiFetch(`${adminTrainerShiftsPath(trainerId)}/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      shifts: shifts.map((s) => ({
        date: s.date.slice(0, 10),
        start_time: toApiTime(s.start_time),
        end_time: toApiTime(s.end_time),
      })),
    }),
  })
  if (res.status === 401) throw new Error("UNAUTHORIZED")
  if (!res.ok) throw new Error("FETCH_FAILED")
  const data = await res.json()
  if (!Array.isArray(data)) return []
  return data.map((row) => parseTrainerShiftOut(row))
}

export type DayShiftWriteBody = {
  date: string
  start_time: string
  end_time: string
}

/** 1日分のシフトを保存（既存があれば1件に集約して更新） */
export async function applyTrainerDayShift(
  trainerId: string,
  body: DayShiftWriteBody,
  existingRows: TrainerShiftRow[],
): Promise<void> {
  const ids = existingRows.map((r) => r.shift_id)
  if (ids.length === 0) {
    await createTrainerShift(trainerId, body)
    return
  }
  for (const id of ids.slice(1)) {
    await deleteTrainerShift(trainerId, id)
  }
  await updateTrainerShift(trainerId, ids[0], body)
}

/** 一括登録プランを API に反映 */
export async function applyBulkMonthPlan(
  trainerId: string,
  plan: BulkMonthPlan,
  apiShiftRowsByDate: Record<string, TrainerShiftRow[] | undefined>,
): Promise<{ applied: number; failed: number }> {
  const creates = plan.actions.filter((a) => a.type === "create")
  const updates = plan.actions.filter((a) => a.type === "update")

  let applied = 0
  let failed = 0

  if (creates.length > 0) {
    try {
      await createTrainerShiftsBulk(
        trainerId,
        creates.map((a) => ({
          date: a.dateKey,
          start_time: a.slot.start,
          end_time: a.slot.end,
        })),
      )
      applied += creates.length
    } catch {
      for (const a of creates) {
        try {
          await createTrainerShift(trainerId, {
            date: a.dateKey,
            start_time: a.slot.start,
            end_time: a.slot.end,
          })
          applied++
        } catch {
          failed++
        }
      }
    }
  }

  for (const a of updates) {
    if (a.type !== "update") continue
    try {
      const rows = apiShiftRowsByDate[a.dateKey] ?? []
      await applyTrainerDayShift(
        trainerId,
        {
          date: a.dateKey,
          start_time: a.slot.start,
          end_time: a.slot.end,
        },
        rows,
      )
      applied++
    } catch {
      failed++
    }
  }

  return { applied, failed }
}
