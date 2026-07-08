/**
 * ヘッダ「新規予約」クリック時のみ渡す。以降の画面ではドラフトに同じ値を保持する。
 */
export interface AdminNewReservationEntryState {
  /** この時刻より前の日時は選べない（ISO 8601） */
  bookingNotBeforeIso: string
}

/**
 * 代理新規予約: 入力画面から確認画面へ渡すドラフト（`location.state`）。
 * `customer_id` 未指定時はサーバー側でメール／電話による顧客マッチ・作成が行われる想定。
 */
export interface AdminNewReservationDraft extends AdminNewReservationEntryState {
  menuId: string
  menuName?: string
  /** 管理カレンダー TZ（JST）の暦日 */
  dateYmd: string
  /** `HH:mm` */
  timeHm: string
  /** メニューから取得した所要時間（分） */
  durationMinutes: number
  /** 担当トレーナー（`trainer_id`） */
  trainerId: string
  trainerName?: string
  customerName: string
  customerEmail: string
  customerId?: string
  customerPhone?: string
  notes?: string
}

export function getBookingNotBeforeIsoFromState(state: unknown): string {
  if (state && typeof state === "object" && "bookingNotBeforeIso" in state) {
    const v = (state as { bookingNotBeforeIso: unknown }).bookingNotBeforeIso
    if (typeof v === "string" && v.length > 0) return v
  }
  return new Date().toISOString()
}

export function isAdminNewReservationDraft(
  state: unknown,
): state is AdminNewReservationDraft {
  if (!state || typeof state !== "object") return false
  const s = state as Record<string, unknown>
  return (
    typeof s.bookingNotBeforeIso === "string" &&
    typeof s.menuId === "string" &&
    typeof s.dateYmd === "string" &&
    typeof s.timeHm === "string" &&
    typeof s.durationMinutes === "number" &&
    Number.isFinite(s.durationMinutes) &&
    s.durationMinutes > 0 &&
    typeof s.trainerId === "string" &&
    typeof s.customerName === "string" &&
    typeof s.customerEmail === "string"
  )
}
