import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react"
import type { TrainerShiftRow } from "@/features/admin/api/trainerShiftsApi"
import { rowsToSlots } from "@/features/admin/api/trainerShiftsApi"
import { toDateKey } from "@/features/admin/lib/calendarUtils"
import type { AvailabilitySlot } from "@/features/admin/lib/shiftAvailability"
import type { Staff } from "@/features/admin/types/staff"

const STORAGE_KEY = "saas_admin_shift_availability_v1"

/** 上書き: 勤務時間 or 明示的な休み */
export type ShiftOverrideValue = AvailabilitySlot | "off"

/** `GET .../shifts` 由来（スタッフID → 日付 → 行） */
export type ApiShiftRowsMap = Record<string, Record<string, TrainerShiftRow[]>>

export type ResolvedShiftDay =
  | { kind: "work"; slot: AvailabilitySlot; moreSlots?: AvailabilitySlot[] }
  | { kind: "off_explicit" }
  | { kind: "none" }

type OverridesMap = Record<string, Record<string, ShiftOverrideValue>>

function loadInitial(): OverridesMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (parsed != null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as OverridesMap
    }
  } catch {
    /* ignore */
  }
  return {}
}

function isSlot(x: unknown): x is AvailabilitySlot {
  return (
    x != null &&
    typeof x === "object" &&
    typeof (x as AvailabilitySlot).start === "string" &&
    typeof (x as AvailabilitySlot).end === "string"
  )
}

function normalizeOverrides(raw: OverridesMap): OverridesMap {
  const next: OverridesMap = {}
  for (const [dateKey, byStaff] of Object.entries(raw)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) continue
    if (byStaff == null || typeof byStaff !== "object") continue
    const inner: Record<string, ShiftOverrideValue> = {}
    for (const [staffId, v] of Object.entries(byStaff)) {
      if (v === "off") inner[staffId] = "off"
      else if (isSlot(v)) inner[staffId] = { start: v.start, end: v.end }
    }
    if (Object.keys(inner).length > 0) next[dateKey] = inner
  }
  return next
}

type AdminShiftAvailabilityContextValue = {
  apiShiftRows: ApiShiftRowsMap
  setApiShiftRows: Dispatch<SetStateAction<ApiShiftRowsMap>>
  resolveStaffDay: (staff: Staff, day: Date) => ResolvedShiftDay
  setOverride: (
    staffId: string,
    dateKey: string,
    value: ShiftOverrideValue | null,
  ) => void
}

const AdminShiftAvailabilityContext =
  createContext<AdminShiftAvailabilityContextValue | null>(null)

export function AdminShiftAvailabilityProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<OverridesMap>(() => normalizeOverrides(loadInitial()))
  const [apiShiftRows, setApiShiftRows] = useState<ApiShiftRowsMap>({})

  const resolveStaffDay = useCallback(
    (staff: Staff, day: Date): ResolvedShiftDay => {
      const dateKey = toDateKey(day)
      const o = overrides[dateKey]?.[staff.id]
      if (o === "off") return { kind: "off_explicit" }
      if (o && typeof o === "object") return { kind: "work", slot: o }
      const rows = apiShiftRows[staff.id]?.[dateKey] ?? []
      if (rows.length === 0) return { kind: "none" }
      const slots = rowsToSlots(rows)
      const [first, ...rest] = slots
      return {
        kind: "work",
        slot: first,
        moreSlots: rest.length > 0 ? rest : undefined,
      }
    },
    [overrides, apiShiftRows],
  )

  const setOverride = useCallback(
    (staffId: string, dateKey: string, value: ShiftOverrideValue | null) => {
      setOverrides((prev) => {
        const next: OverridesMap = { ...prev }
        const dayMap = { ...(next[dateKey] ?? {}) }
        if (value === null) {
          delete dayMap[staffId]
          if (Object.keys(dayMap).length === 0) delete next[dateKey]
          else next[dateKey] = dayMap
        } else {
          next[dateKey] = { ...dayMap, [staffId]: value }
        }
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        } catch {
          /* ignore */
        }
        return next
      })
    },
    [],
  )

  const value = useMemo(
    () => ({
      apiShiftRows,
      setApiShiftRows,
      resolveStaffDay,
      setOverride,
    }),
    [apiShiftRows, resolveStaffDay, setOverride],
  )

  return (
    <AdminShiftAvailabilityContext.Provider value={value}>
      {children}
    </AdminShiftAvailabilityContext.Provider>
  )
}

export function useAdminShiftAvailability() {
  const ctx = useContext(AdminShiftAvailabilityContext)
  if (!ctx) {
    throw new Error("useAdminShiftAvailability must be used within AdminShiftAvailabilityProvider")
  }
  return ctx
}
