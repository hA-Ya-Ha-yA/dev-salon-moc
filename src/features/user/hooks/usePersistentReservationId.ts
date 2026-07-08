import { useEffect } from "react"
import { useLocation } from "react-router-dom"

const RESERVATION_ID_STORAGE_KEY = "user:last-reservation-id"
const RESERVATION_UPDATE_INTENT_KEY = "user:last-reservation-update-intent"
/** userReservationApi と同じキー（過去予約 meta から fallback で参照する） */
const RESERVATION_META_KEY = "user:reservations:v2"

type LocationStateWithBooking = {
  reservationId?: string
  isUpdatingExistingReservation?: boolean
} | null

function safeReadSession(key: string): string {
  if (typeof window === "undefined") return ""
  try {
    return window.sessionStorage.getItem(key) ?? ""
  } catch {
    return ""
  }
}

function safeWriteSession(key: string, value: string) {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
}

function safeRemoveSession(key: string) {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

/** localStorage に蓄積される予約 meta から、最後に保存した（最新の）予約 ID を返す */
function readLatestReservationIdFromMeta(): string {
  if (typeof window === "undefined") return ""
  try {
    const raw = window.localStorage.getItem(RESERVATION_META_KEY)
    if (!raw) return ""
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return ""
    // userReservationApi は新しい予約を配列の先頭に積むので index 0 が最新
    for (let i = 0; i < parsed.length; i++) {
      const item = parsed[i] as { id?: unknown }
      if (typeof item?.id === "string" && item.id.length > 0) return item.id
    }
    return ""
  } catch {
    return ""
  }
}

export function usePersistentReservationId(): string {
  const location = useLocation()
  const fromState = ((location.state as LocationStateWithBooking)?.reservationId ?? "").trim()
  const stored = safeReadSession(RESERVATION_ID_STORAGE_KEY) || readLatestReservationIdFromMeta()
  const resolved = fromState || stored

  useEffect(() => {
    if (!fromState) return
    safeWriteSession(RESERVATION_ID_STORAGE_KEY, fromState)
  }, [fromState])

  /** ルーター state がリロード等で消えても、予約変更フローの意図を残す */
  useEffect(() => {
    const st = location.state as LocationStateWithBooking
    if (!st || typeof st !== "object" || !("isUpdatingExistingReservation" in st)) return
    if (st.isUpdatingExistingReservation === true) {
      safeWriteSession(RESERVATION_UPDATE_INTENT_KEY, "1")
      return
    }
    if (st.isUpdatingExistingReservation === false) {
      clearReservationUpdateIntent()
    }
  }, [location.state])

  return resolved
}

export function setReservationUpdateIntent(value: boolean): void {
  if (value) safeWriteSession(RESERVATION_UPDATE_INTENT_KEY, "1")
  else safeRemoveSession(RESERVATION_UPDATE_INTENT_KEY)
}

export function readReservationUpdateIntent(): boolean {
  return safeReadSession(RESERVATION_UPDATE_INTENT_KEY) === "1"
}

export function clearReservationUpdateIntent(): void {
  safeRemoveSession(RESERVATION_UPDATE_INTENT_KEY)
}
