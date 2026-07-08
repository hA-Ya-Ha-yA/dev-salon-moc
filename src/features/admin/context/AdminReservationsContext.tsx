import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { buildMockReservations } from "@/features/admin/api/reservationsApi"
import type { Reservation } from "@/features/admin/types/reservation"

const STORAGE_KEY = "saas_admin_reservations_v2"

type AdminReservationsContextValue = {
  reservations: Reservation[]
  loading: boolean
  /** 予約カレンダー用 API などで一覧を差し替える（localStorage は更新しない） */
  replaceReservations: (items: Reservation[]) => void
  updateReservationStatus: (id: string, status: "CONFIRMED" | "CANCELLED") => void
  updateReservationMemo: (id: string, memo: string | undefined) => void
  updateReservationAssignee: (id: string, assigneeId: string) => void
  getReservationById: (id: string) => Reservation | undefined
  cancelledReservations: Reservation[]
}

const AdminReservationsContext = createContext<AdminReservationsContextValue | null>(null)

function loadInitial(): Reservation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Reservation[]
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {
    /* ignore */
  }
  return buildMockReservations()
}

export function AdminReservationsProvider({ children }: { children: ReactNode }) {
  const [reservations, setReservations] = useState<Reservation[]>(() => loadInitial())
  const [loading] = useState(false)

  const replaceReservations = useCallback((items: Reservation[]) => {
    setReservations(items)
  }, [])

  const updateReservationStatus = useCallback(
    (id: string, status: "CONFIRMED" | "CANCELLED") => {
      setReservations((prev) => {
        const next = prev.map((r) => (r.id === id ? { ...r, status } : r))
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        return next
      })
    },
    [],
  )

  const updateReservationMemo = useCallback((id: string, memo: string | undefined) => {
    setReservations((prev) => {
      const next = prev.map((r) => {
        if (r.id !== id) return r
        const trimmed = memo?.trim()
        if (!trimmed) {
          const next = { ...r }
          delete next.memo
          return next
        }
        return { ...r, memo: trimmed }
      })
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const updateReservationAssignee = useCallback((id: string, assigneeId: string) => {
    setReservations((prev) => {
      const next = prev.map((r) =>
        r.id === id ? { ...r, assigneeId, trainerId: assigneeId } : r,
      )
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const getReservationById = useCallback(
    (id: string) => reservations.find((r) => r.id === id),
    [reservations],
  )

  const cancelledReservations = useMemo(
    () =>
      [...reservations]
        .filter((r) => r.status === "CANCELLED")
        .sort(
          (a, b) =>
            new Date(b.startAt).getTime() - new Date(a.startAt).getTime(),
        ),
    [reservations],
  )

  const value = useMemo(
    () => ({
      reservations,
      loading,
      replaceReservations,
      updateReservationStatus,
      updateReservationMemo,
      updateReservationAssignee,
      getReservationById,
      cancelledReservations,
    }),
    [
      reservations,
      loading,
      replaceReservations,
      updateReservationStatus,
      updateReservationMemo,
      updateReservationAssignee,
      getReservationById,
      cancelledReservations,
    ],
  )

  return (
    <AdminReservationsContext.Provider value={value}>
      {children}
    </AdminReservationsContext.Provider>
  )
}

export function useAdminReservations() {
  const ctx = useContext(AdminReservationsContext)
  if (!ctx) {
    throw new Error("useAdminReservations must be used within AdminReservationsProvider")
  }
  return ctx
}
