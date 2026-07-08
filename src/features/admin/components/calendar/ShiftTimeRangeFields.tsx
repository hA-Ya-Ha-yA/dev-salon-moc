import { useCallback, useEffect, useMemo } from "react"
import { Label } from "@/components/ui/label"
import {
  buildEndTimeOptions,
  buildStartTimeOptions,
  padTimePart,
  timeToMinutes,
} from "@/features/admin/lib/businessHours"
import { cn } from "@/lib/utils"

const selectClassName = cn(
  "border-input bg-background h-9 min-w-[4.5rem] rounded-md border px-2 text-sm shadow-xs",
  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
)

export type ShiftTimeBusinessWindow = {
  start: string
  end: string
}

interface ShiftTimeRangeFieldsProps {
  start: string
  end: string
  onStartChange: (hhmm: string) => void
  onEndChange: (hhmm: string) => void
  /** 営業時間の範囲。null のときは入力不可 */
  businessWindow: ShiftTimeBusinessWindow | null
  disabled?: boolean
}

/**
 * シフトの開始・終了時刻入力（時・分のセレクト）。個別登録・一括登録で共通利用。
 */
export function ShiftTimeRangeFields({
  start,
  end,
  onStartChange,
  onEndChange,
  businessWindow,
  disabled = false,
}: ShiftTimeRangeFieldsProps) {
  const validStartTimes = useMemo(() => {
    if (!businessWindow) return []
    return buildStartTimeOptions(businessWindow.start, businessWindow.end)
  }, [businessWindow])

  const validEndTimes = useMemo(() => {
    if (!businessWindow) return []
    return buildEndTimeOptions(businessWindow.end, start)
  }, [businessWindow, start])

  const hoursForStart = useMemo(() => {
    const s = new Set<number>()
    for (const t of validStartTimes) {
      s.add(parseInt(t.split(":")[0], 10))
    }
    return [...s].sort((a, b) => a - b)
  }, [validStartTimes])

  const minutesForStartHour = useCallback(
    (hour: number) =>
      validStartTimes
        .filter((t) => parseInt(t.split(":")[0], 10) === hour)
        .map((t) => t.split(":")[1]),
    [validStartTimes],
  )

  const hoursForEnd = useMemo(() => {
    const s = new Set<number>()
    for (const t of validEndTimes) {
      s.add(parseInt(t.split(":")[0], 10))
    }
    return [...s].sort((a, b) => a - b)
  }, [validEndTimes])

  const minutesForEndHour = useCallback(
    (hour: number) =>
      validEndTimes
        .filter((t) => parseInt(t.split(":")[0], 10) === hour)
        .map((t) => t.split(":")[1]),
    [validEndTimes],
  )

  /** 開始が変わったら、終了が営業範囲外または開始以前なら補正 */
  useEffect(() => {
    if (!businessWindow) return
    const ends = buildEndTimeOptions(businessWindow.end, start)
    if (ends.length === 0) return
    const p = padTimePart(end)
    const pm = timeToMinutes(p)
    const sm = timeToMinutes(start)
    const be = timeToMinutes(businessWindow.end)
    let next = p
    if (pm <= sm) next = ends[0]
    else if (pm > be) next = ends[ends.length - 1]
    else if (!ends.includes(p)) {
      let nearest = ends[0]
      let bestDiff = Infinity
      for (const e of ends) {
        const d = Math.abs(timeToMinutes(e) - pm)
        if (d < bestDiff) {
          bestDiff = d
          nearest = e
        }
      }
      next = nearest
    }
    if (next !== end) onEndChange(next)
    // end / onEndChange は補正時のみ参照（開始変更に連動）
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [start, businessWindow])

  const startHour = parseInt(start.split(":")[0], 10)
  const startMinuteStr = start.split(":")[1] ?? "00"
  const endHour = parseInt(end.split(":")[0], 10)
  const endMinuteStr = end.split(":")[1] ?? "00"

  const fieldsDisabled =
    disabled || !businessWindow || validStartTimes.length === 0

  const setStartFromHour = (hourStr: string) => {
    const hour = Number(hourStr)
    const mins = minutesForStartHour(hour)
    const nextMin = mins.includes(startMinuteStr) ? startMinuteStr : mins[0] ?? "00"
    onStartChange(`${String(hour).padStart(2, "0")}:${nextMin}`)
  }

  const setStartFromMinute = (minStr: string) => {
    onStartChange(`${String(startHour).padStart(2, "0")}:${minStr}`)
  }

  const setEndFromHour = (hourStr: string) => {
    const hour = Number(hourStr)
    const mins = minutesForEndHour(hour)
    const nextMin = mins.includes(endMinuteStr) ? endMinuteStr : mins[0] ?? "00"
    onEndChange(`${String(hour).padStart(2, "0")}:${nextMin}`)
  }

  const setEndFromMinute = (minStr: string) => {
    onEndChange(`${String(endHour).padStart(2, "0")}:${minStr}`)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>開始</Label>
        <div className="flex flex-wrap items-center gap-1.5">
          <select
            aria-label="開始の時"
            className={selectClassName}
            disabled={fieldsDisabled}
            value={String(startHour).padStart(2, "0")}
            onChange={(e) => setStartFromHour(e.target.value)}
          >
            {hoursForStart.map((h) => (
              <option key={h} value={String(h).padStart(2, "0")}>
                {h}
              </option>
            ))}
          </select>
          <span className="text-sm text-muted-foreground">時</span>
          <select
            aria-label="開始の分"
            className={selectClassName}
            disabled={fieldsDisabled || minutesForStartHour(startHour).length === 0}
            value={startMinuteStr}
            onChange={(e) => setStartFromMinute(e.target.value)}
          >
            {minutesForStartHour(startHour).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <span className="text-sm text-muted-foreground">分</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label>終了</Label>
        <div className="flex flex-wrap items-center gap-1.5">
          <select
            aria-label="終了の時"
            className={selectClassName}
            disabled={fieldsDisabled || validEndTimes.length === 0}
            value={String(endHour).padStart(2, "0")}
            onChange={(e) => setEndFromHour(e.target.value)}
          >
            {hoursForEnd.map((h) => (
              <option key={h} value={String(h).padStart(2, "0")}>
                {h}
              </option>
            ))}
          </select>
          <span className="text-sm text-muted-foreground">時</span>
          <select
            aria-label="終了の分"
            className={selectClassName}
            disabled={fieldsDisabled || minutesForEndHour(endHour).length === 0}
            value={endMinuteStr}
            onChange={(e) => setEndFromMinute(e.target.value)}
          >
            {minutesForEndHour(endHour).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <span className="text-sm text-muted-foreground">分</span>
        </div>
      </div>
    </div>
  )
}
