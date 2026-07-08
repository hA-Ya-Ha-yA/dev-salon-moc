const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"] as const

function parseDateSafely(date: string) {
  return new Date(`${date}T00:00:00`)
}

function resolveWeekdayLabel(date: string) {
  const parsed = parseDateSafely(date)
  if (Number.isNaN(parsed.getTime())) return ""
  return WEEKDAY_LABELS[parsed.getDay()]
}

export function formatDateLongWithWeekday(date: string) {
  const parsed = parseDateSafely(date)
  if (Number.isNaN(parsed.getTime())) return date
  return `${parsed.getFullYear()}年${parsed.getMonth() + 1}月${parsed.getDate()}日 (${WEEKDAY_LABELS[parsed.getDay()]})`
}

export function formatDateShortWithWeekday(date: string) {
  const parsed = parseDateSafely(date)
  if (Number.isNaN(parsed.getTime())) return date
  return `${parsed.getMonth() + 1}/${parsed.getDate()} (${WEEKDAY_LABELS[parsed.getDay()]})`
}

export function formatSlashDateTimeWithWeekday(date: string, time: string) {
  const weekday = resolveWeekdayLabel(date)
  return `${date.replaceAll("-", "/")}${weekday ? `(${weekday})` : ""} ${time}`
}

/** HH:mm に分を加算（予約の想定終了時刻用） */
export function addMinutesToTimeString(time: string, minutes: number): string {
  const [h, m] = time.split(":").map((v) => Number.parseInt(v, 10))
  if (!Number.isFinite(h) || !Number.isFinite(m)) return time
  const base = new Date(2000, 0, 1, h, m, 0, 0)
  base.setMinutes(base.getMinutes() + minutes)
  const hh = String(base.getHours()).padStart(2, "0")
  const mm = String(base.getMinutes()).padStart(2, "0")
  return `${hh}:${mm}`
}
