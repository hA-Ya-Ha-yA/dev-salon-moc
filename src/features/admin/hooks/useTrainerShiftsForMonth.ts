import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  fetchTrainerShifts,
  groupTrainerShiftRowsByDate,
  type TrainerShiftRow,
} from "@/features/admin/api/trainerShiftsApi"
import { useAdminShiftAvailability } from "@/features/admin/context/AdminShiftAvailabilityContext"
import { getShiftCalendarGridDateRange } from "@/features/admin/lib/shiftAvailability"
import type { Staff } from "@/features/admin/types/staff"
import { ROUTES } from "@/constants/routes"

/**
 * 表示中の月のグリッド範囲で全スタッフのシフトを GET し、`apiShiftRows` に格納する。
 */
export function useTrainerShiftsForMonth(staffList: Staff[], monthAnchor: Date) {
  const navigate = useNavigate()
  const { setApiShiftRows } = useAdminShiftAvailability()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [tick, setTick] = useState(0)
  const staffRef = useRef(staffList)
  staffRef.current = staffList

  const staffKey = useMemo(
    () =>
      [...staffList]
        .map((s) => s.id)
        .sort()
        .join("\0"),
    [staffList],
  )

  const monthMs = monthAnchor.getTime()

  const refetch = useCallback(() => {
    setTick((t) => t + 1)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function run() {
      const list = staffRef.current
      if (list.length === 0) {
        setApiShiftRows({})
        setLoading(false)
        setError(false)
        return
      }

      setLoading(true)
      setError(false)
      const range = getShiftCalendarGridDateRange(monthAnchor)

      try {
        const results = await Promise.all(
          list.map(async (s) => {
            const rows = await fetchTrainerShifts(s.id, range)
            return { id: s.id, rows }
          }),
        )
        if (cancelled) return

        const merged: Record<string, Record<string, TrainerShiftRow[]>> = {}
        for (const { id, rows } of results) {
          merged[id] = groupTrainerShiftRowsByDate(rows, id)
        }
        setApiShiftRows(merged)
      } catch (e) {
        if (cancelled) return
        if (e instanceof Error && e.message === "UNAUTHORIZED") {
          navigate(ROUTES.backofficeLogin, { replace: true })
          return
        }
        setError(true)
        setApiShiftRows({})
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void run()

    return () => {
      cancelled = true
      setApiShiftRows({})
    }
  }, [staffKey, monthMs, monthAnchor, setApiShiftRows, navigate, tick])

  return { loading, error, refetch }
}
