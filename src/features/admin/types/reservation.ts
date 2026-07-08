export type ReservationStatus = "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW"

export interface Reservation {
  id: string
  customerName: string
  customerEmail: string
  /** メニュー名（API `menu_name`） */
  menuName?: string
  /** 電話番号（API `customer_phone`） */
  customerPhone?: string
  startAt: string // ISO 8601
  endAt: string
  status: ReservationStatus
  /** 担当者ID */
  assigneeId: string
  /** API `trainer_id`（`trainers` の PK。無効化可否判定などに使用） */
  trainerId?: string
  /** API の trainer_name（スタッフ一覧に無い場合の色分け・絞り込み用） */
  trainerName?: string
  memo?: string
  paymentId?: string
  paymentProvider?: string
  paymentMethod?: string
  paymentStatus?: string
  paymentAmountYen?: number
  paymentCurrency?: string
  paymentRecordStatus?: string
  paymentRefundAmount?: number
  paymentPaidAt?: string
  createdAt: string
}
