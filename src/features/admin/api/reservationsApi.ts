import { ADMIN_RESERVATIONS_LIST_PATH } from "@/constants/adminApi"
import { apiFetch } from "@/lib/api"
import {
  ADMIN_CALENDAR_TIME_ZONE,
  getDateKeyInTimeZone,
  startOfDay,
  startOfWeek,
} from "@/features/admin/lib/calendarUtils"
import type { Reservation, ReservationStatus } from "@/features/admin/types/reservation"
import type { Staff } from "@/features/admin/types/staff"

/** 日付を YYYY-MM-DD にフォーマット（JST の日付で統一） */
function formatDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

const MOCK_MENU_SAMPLES = [
  "パーソナル 60分",
  "パーソナル 90分",
  "初回体験",
  "ペアトレーニング",
  "コンディショニング",
] as const

/** 今日を基準にした3日分のモック予約を生成（常にカレンダーに表示されるようにする） */
export function buildMockReservations(): Reservation[] {
  const base = new Date()
  const day1 = new Date(base)
  const day2 = new Date(base)
  day2.setDate(day2.getDate() + 1)
  const day3 = new Date(base)
  day3.setDate(day3.getDate() + 2)

  const d1 = formatDateKey(day1)
  const d2 = formatDateKey(day2)
  const d3 = formatDateKey(day3)

  return [
    {
      id: "res_001",
      customerName: "山田 太郎",
      customerEmail: "yamada@example.com",
      startAt: `${d1}T09:00:00+09:00`,
      endAt: `${d1}T10:00:00+09:00`,
      status: "CONFIRMED",
      assigneeId: "st_001",
      memo: "初回利用",
      createdAt: base.toISOString(),
    },
    {
      id: "res_002",
      customerName: "佐藤 花子",
      customerEmail: "sato@example.com",
      startAt: `${d1}T11:00:00+09:00`,
      endAt: `${d1}T12:00:00+09:00`,
      status: "CONFIRMED",
      assigneeId: "st_002",
      createdAt: base.toISOString(),
    },
    {
      id: "res_003",
      customerName: "鈴木 一郎",
      customerEmail: "suzuki@example.com",
      startAt: `${d1}T14:00:00+09:00`,
      endAt: `${d1}T15:30:00+09:00`,
      status: "CONFIRMED",
      assigneeId: "st_001",
      memo: "90分希望",
      createdAt: base.toISOString(),
    },
    {
      id: "res_004",
      customerName: "田中 美咲",
      customerEmail: "tanaka@example.com",
      startAt: `${d2}T10:00:00+09:00`,
      endAt: `${d2}T11:00:00+09:00`,
      status: "CONFIRMED",
      assigneeId: "st_003",
      createdAt: base.toISOString(),
    },
    {
      id: "res_005",
      customerName: "高橋 健太",
      customerEmail: "takahashi@example.com",
      startAt: `${d2}T13:00:00+09:00`,
      endAt: `${d2}T14:00:00+09:00`,
      status: "CONFIRMED",
      assigneeId: "st_002",
      createdAt: base.toISOString(),
    },
    {
      id: "res_006",
      customerName: "伊藤 恵子",
      customerEmail: "ito@example.com",
      startAt: `${d2}T15:30:00+09:00`,
      endAt: `${d2}T16:30:00+09:00`,
      status: "CONFIRMED",
      assigneeId: "st_001",
      memo: "キャンセル待ちから繰り上げ",
      createdAt: base.toISOString(),
    },
    {
      id: "res_007",
      customerName: "渡辺 大輔",
      customerEmail: "watanabe@example.com",
      startAt: `${d3}T09:00:00+09:00`,
      endAt: `${d3}T10:00:00+09:00`,
      status: "CONFIRMED",
      assigneeId: "st_003",
      createdAt: base.toISOString(),
    },
    {
      id: "res_008",
      customerName: "中村 優子",
      customerEmail: "nakamura@example.com",
      startAt: `${d3}T11:00:00+09:00`,
      endAt: `${d3}T12:00:00+09:00`,
      status: "CONFIRMED",
      assigneeId: "st_002",
      memo: "午前中希望",
      createdAt: base.toISOString(),
    },
    {
      id: "res_009",
      customerName: "小林 翔太",
      customerEmail: "kobayashi@example.com",
      startAt: `${d3}T14:00:00+09:00`,
      endAt: `${d3}T15:00:00+09:00`,
      status: "CONFIRMED",
      assigneeId: "st_003",
      createdAt: base.toISOString(),
    },
    // 同日 10:00-11:00 に3担当が重複
    {
      id: "res_010",
      customerName: "松本 直樹",
      customerEmail: "matsumoto@example.com",
      startAt: `${d1}T10:00:00+09:00`,
      endAt: `${d1}T11:00:00+09:00`,
      status: "CONFIRMED",
      assigneeId: "st_001",
      createdAt: base.toISOString(),
    },
    {
      id: "res_011",
      customerName: "井上 さくら",
      customerEmail: "inoue@example.com",
      startAt: `${d1}T10:00:00+09:00`,
      endAt: `${d1}T11:00:00+09:00`,
      status: "CONFIRMED",
      assigneeId: "st_002",
      memo: "ペア予約",
      createdAt: base.toISOString(),
    },
    {
      id: "res_012",
      customerName: "木村 拓也",
      customerEmail: "kimura@example.com",
      startAt: `${d1}T10:00:00+09:00`,
      endAt: `${d1}T11:00:00+09:00`,
      status: "CONFIRMED",
      assigneeId: "st_003",
      createdAt: base.toISOString(),
    },
    // 同日 13:00-14:00 に2担当が重複
    {
      id: "res_013",
      customerName: "林 美香",
      customerEmail: "hayashi@example.com",
      startAt: `${d1}T13:00:00+09:00`,
      endAt: `${d1}T14:00:00+09:00`,
      status: "CONFIRMED",
      assigneeId: "st_001",
      createdAt: base.toISOString(),
    },
    {
      id: "res_014",
      customerName: "斎藤 誠",
      customerEmail: "saito@example.com",
      startAt: `${d1}T13:00:00+09:00`,
      endAt: `${d1}T14:00:00+09:00`,
      status: "CONFIRMED",
      assigneeId: "st_002",
      createdAt: base.toISOString(),
    },
    {
      id: "res_015",
      customerName: "岡田 由美",
      customerEmail: "okada@example.com",
      startAt: `${d1}T16:00:00+09:00`,
      endAt: `${d1}T17:00:00+09:00`,
      status: "CONFIRMED",
      assigneeId: "st_003",
      createdAt: base.toISOString(),
    },
    // 2日目 9:00-10:00 に2担当が重複
    {
      id: "res_016",
      customerName: "後藤 健一",
      customerEmail: "goto@example.com",
      startAt: `${d2}T09:00:00+09:00`,
      endAt: `${d2}T10:00:00+09:00`,
      status: "CONFIRMED",
      assigneeId: "st_002",
      createdAt: base.toISOString(),
    },
    {
      id: "res_017",
      customerName: "長谷川 彩",
      customerEmail: "hasegawa@example.com",
      startAt: `${d2}T09:00:00+09:00`,
      endAt: `${d2}T10:00:00+09:00`,
      status: "CONFIRMED",
      assigneeId: "st_003",
      memo: "午前希望",
      createdAt: base.toISOString(),
    },
    // 2日目 11:00-12:00 に3担当が重複
    {
      id: "res_018",
      customerName: "村上 大輔",
      customerEmail: "murakami@example.com",
      startAt: `${d2}T11:00:00+09:00`,
      endAt: `${d2}T12:00:00+09:00`,
      status: "CONFIRMED",
      assigneeId: "st_001",
      createdAt: base.toISOString(),
    },
    {
      id: "res_019",
      customerName: "石井 花子",
      customerEmail: "ishii@example.com",
      startAt: `${d2}T11:00:00+09:00`,
      endAt: `${d2}T12:00:00+09:00`,
      status: "CONFIRMED",
      assigneeId: "st_002",
      createdAt: base.toISOString(),
    },
    {
      id: "res_020",
      customerName: "清水 涼太",
      customerEmail: "shimizu@example.com",
      startAt: `${d2}T11:00:00+09:00`,
      endAt: `${d2}T12:00:00+09:00`,
      status: "CONFIRMED",
      assigneeId: "st_003",
      createdAt: base.toISOString(),
    },
    {
      id: "res_021",
      customerName: "森田 優",
      customerEmail: "morita@example.com",
      startAt: `${d2}T14:00:00+09:00`,
      endAt: `${d2}T15:00:00+09:00`,
      status: "CONFIRMED",
      assigneeId: "st_001",
      createdAt: base.toISOString(),
    },
    {
      id: "res_022",
      customerName: "阿部 真一",
      customerEmail: "abe@example.com",
      startAt: `${d2}T14:00:00+09:00`,
      endAt: `${d2}T15:00:00+09:00`,
      status: "CONFIRMED",
      assigneeId: "st_003",
      createdAt: base.toISOString(),
    },
    // 3日目 10:00-11:00 に2担当が重複
    {
      id: "res_023",
      customerName: "山本 恵子",
      customerEmail: "yamamoto@example.com",
      startAt: `${d3}T10:00:00+09:00`,
      endAt: `${d3}T11:00:00+09:00`,
      status: "CONFIRMED",
      assigneeId: "st_001",
      createdAt: base.toISOString(),
    },
    {
      id: "res_024",
      customerName: "吉田 翔",
      customerEmail: "yoshida@example.com",
      startAt: `${d3}T10:00:00+09:00`,
      endAt: `${d3}T11:00:00+09:00`,
      status: "CONFIRMED",
      assigneeId: "st_003",
      createdAt: base.toISOString(),
    },
    // 3日目 13:00-14:00 に3担当が重複
    {
      id: "res_025",
      customerName: "福田 美咲",
      customerEmail: "fukuda@example.com",
      startAt: `${d3}T13:00:00+09:00`,
      endAt: `${d3}T14:00:00+09:00`,
      status: "CONFIRMED",
      assigneeId: "st_001",
      createdAt: base.toISOString(),
    },
    {
      id: "res_026",
      customerName: "西村 剛",
      customerEmail: "nishimura@example.com",
      startAt: `${d3}T13:00:00+09:00`,
      endAt: `${d3}T14:00:00+09:00`,
      status: "CONFIRMED",
      assigneeId: "st_002",
      memo: "初回",
      createdAt: base.toISOString(),
    },
    {
      id: "res_027",
      customerName: "青木 千尋",
      customerEmail: "aoki@example.com",
      startAt: `${d3}T13:00:00+09:00`,
      endAt: `${d3}T14:00:00+09:00`,
      status: "CONFIRMED",
      assigneeId: "st_003",
      createdAt: base.toISOString(),
    },
    {
      id: "res_028",
      customerName: "藤田 陽子",
      customerEmail: "fujita@example.com",
      startAt: `${d3}T15:30:00+09:00`,
      endAt: `${d3}T16:30:00+09:00`,
      status: "CONFIRMED",
      assigneeId: "st_002",
      createdAt: base.toISOString(),
    },
    {
      id: "res_029",
      customerName: "松浦 竜也",
      customerEmail: "matsuura@example.com",
      startAt: `${d3}T15:30:00+09:00`,
      endAt: `${d3}T16:30:00+09:00`,
      status: "CONFIRMED",
      assigneeId: "st_003",
      createdAt: base.toISOString(),
    },
  ].map((r, i) => ({
    ...r,
    menuName: MOCK_MENU_SAMPLES[i % MOCK_MENU_SAMPLES.length],
  })) as Reservation[]
}

export async function fetchAllReservations(): Promise<Reservation[]> {
  await new Promise((r) => setTimeout(r, 300))
  return buildMockReservations()
}

export async function fetchReservationById(id: string): Promise<Reservation | null> {
  const all = buildMockReservations()
  const found = all.find((r) => r.id === id)
  return found ?? null
}

/** Struct `ReservationOut`（JSON は snake_case） */
export interface AdminReservationOut {
  reservation_id: string
  menu_id?: string
  menu_name?: string | null
  start_at: string
  service_end_at: string
  customer_name: string
  customer_email?: string
  customer_phone?: string | null
  notes?: string | null
  status: string
  customer_id?: string | null
  trainer_id?: string | null
  trainer_name?: string | null
  booking_type?: string | null
  source?: string | null
  payment_status?: string | null
  payment_method?: string | null
  payment_id?: string | null
  payment_provider?: string | null
  payment_amount_yen?: number | null
  payment_currency?: string | null
  payment_record_status?: string | null
  payment_refund_amount?: number | null
  payment_paid_at?: string | null
  created_at?: string
}

/** Struct `PaginatedReservationResponse` */
export interface PaginatedReservationResponse {
  items: AdminReservationOut[]
  total: number
  page: number
  per_page: number
}

function hashTrainerKey(name: string): string {
  let h = 2166136261
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return `tn_${(h >>> 0).toString(16)}`
}

function mapStructStatusToReservationStatus(s: string): ReservationStatus {
  switch (s) {
    case "BOOKED":
      return "CONFIRMED"
    case "CANCELED":
      return "CANCELLED"
    case "DONE":
      return "COMPLETED"
    case "NOSHOW":
      return "NO_SHOW"
    default:
      return "CONFIRMED"
  }
}

/** `PATCH …/reservations/{id}/status` のリクエストボディ `status` と一致 */
export type AdminReservationApiStatus = "BOOKED" | "DONE" | "NOSHOW" | "CANCELED"

/** フロントの `ReservationStatus` を API のステータス文字列に変換 */
export function mapReservationStatusToApiStatus(
  s: ReservationStatus,
): AdminReservationApiStatus {
  switch (s) {
    case "CONFIRMED":
      return "BOOKED"
    case "COMPLETED":
      return "DONE"
    case "NO_SHOW":
      return "NOSHOW"
    case "CANCELLED":
      return "CANCELED"
    default:
      return "BOOKED"
  }
}

export function adminReservationApiStatusLabel(
  status: AdminReservationApiStatus,
): string {
  switch (status) {
    case "BOOKED":
      return "予約確定"
    case "DONE":
      return "完了"
    case "NOSHOW":
      return "ノーショー（無断キャンセル）"
    case "CANCELED":
      return "キャンセル"
  }
}

export function mapApiReservationRowToReservation(
  row: AdminReservationOut,
  staffList: Staff[],
): Reservation {
  const trainerName = String(row.trainer_name ?? "").trim()
  const tid = row.trainer_id ? String(row.trainer_id) : ""
  const staffById = tid ? staffList.find((s) => s.id === tid) : undefined
  const staffByName = staffList.find((s) => s.name.trim() === trainerName)
  const assigneeId =
    staffById?.id ??
    staffByName?.id ??
    (tid ? `tid_${tid}` : hashTrainerKey(trainerName || "unknown"))

  const memo = row.notes?.trim()
  const menuName = row.menu_name?.trim()
  const customerPhone = row.customer_phone?.trim()
  return {
    id: String(row.reservation_id),
    customerName: String(row.customer_name ?? ""),
    customerEmail: String(row.customer_email ?? ""),
    menuName: menuName ? menuName : undefined,
    customerPhone: customerPhone ? customerPhone : undefined,
    startAt: String(row.start_at),
    endAt: String(row.service_end_at),
    status: mapStructStatusToReservationStatus(row.status),
    assigneeId,
    trainerId: tid ? tid : undefined,
    trainerName: trainerName || undefined,
    memo: memo ? memo : undefined,
    paymentId: row.payment_id ? String(row.payment_id) : undefined,
    paymentProvider: row.payment_provider ?? undefined,
    paymentMethod: row.payment_method ?? undefined,
    paymentStatus: row.payment_status ?? undefined,
    paymentAmountYen:
      typeof row.payment_amount_yen === "number" ? row.payment_amount_yen : undefined,
    paymentCurrency: row.payment_currency ?? undefined,
    paymentRecordStatus: row.payment_record_status ?? undefined,
    paymentRefundAmount:
      typeof row.payment_refund_amount === "number" ? row.payment_refund_amount : undefined,
    paymentPaidAt: row.payment_paid_at ?? undefined,
    createdAt: String(row.created_at ?? row.start_at),
  }
}

export type FetchAdminReservationsOptions = {
  /** カレンダー表示モード。`month` のときは日付フィルタなし（全件をページング） */
  viewMode: "day" | "week" | "month"
  /** 表示基準日（日ビュー・週ビューのフィルタに使用） */
  anchorDate: Date
  /**
   * API の `date` クエリにそのまま渡す YYYY-MM-DD。
   * 指定時は `anchorDate` より優先（例: 日本時間の当日で Struct と一致させる）
   */
  dateKeyOverride?: string
}

function appendListQuery(
  params: URLSearchParams,
  options: FetchAdminReservationsOptions,
): void {
  if (options.viewMode === "month") {
    return
  }
  const dateStr =
    options.dateKeyOverride ??
    getDateKeyInTimeZone(
      options.viewMode === "week"
        ? startOfWeek(options.anchorDate)
        : startOfDay(options.anchorDate),
      ADMIN_CALENDAR_TIME_ZONE,
    )
  params.set("date", dateStr)
  params.set("view", options.viewMode === "week" ? "week" : "day")
}

/**
 * Struct `GET /api/admin/reservations`（要ログイン Cookie）
 *
 * レスポンスは `PaginatedReservationResponse`（`items`, `total`, `page`, `per_page`）。
 * `month` 表示では API が月単位未対応のため日付指定なしで全件をページング取得する。
 */
export async function fetchAdminReservations(
  staffList: Staff[],
  options: FetchAdminReservationsOptions,
): Promise<Reservation[]> {
  const perPage = 100
  const collected: Reservation[] = []
  let page = 1
  let total = 0

  while (true) {
    const params = new URLSearchParams()
    params.set("page", String(page))
    params.set("per_page", String(perPage))
    appendListQuery(params, options)

    const url = `${ADMIN_RESERVATIONS_LIST_PATH}?${params.toString()}`
    const res = await apiFetch(url, { method: "GET" })
    if (res.status === 401) {
      throw new Error("UNAUTHORIZED")
    }
    if (!res.ok) {
      throw new Error("FETCH_FAILED")
    }

    const data = (await res.json()) as unknown
    let itemsRaw: unknown[]

    if (Array.isArray(data)) {
      itemsRaw = data
      total = itemsRaw.length
    } else {
      const body = data as PaginatedReservationResponse
      if (!body || !Array.isArray(body.items)) {
        throw new Error("INVALID")
      }
      itemsRaw = body.items
      total = typeof body.total === "number" ? body.total : itemsRaw.length
    }

    for (const row of itemsRaw) {
      collected.push(
        mapApiReservationRowToReservation(row as AdminReservationOut, staffList),
      )
    }

    if (collected.length >= total || itemsRaw.length === 0) {
      break
    }
    page += 1
  }

  return collected
}

/** 予約が `trainer_id`（`Staff.id` と同一）に紐づくか */
export function reservationBelongsToTrainer(
  r: Reservation,
  trainerId: string,
): boolean {
  if (r.trainerId && r.trainerId === trainerId) return true
  if (r.assigneeId === trainerId) return true
  if (r.assigneeId === `tid_${trainerId}`) return true
  return false
}

/**
 * 現在時刻以降に開始する、そのトレーナーに割り当てられた予約件数（キャンセルは除外）。
 */
export function countFutureReservationsForTrainer(
  trainerId: string,
  reservations: Reservation[],
  now: Date = new Date(),
): number {
  const t0 = now.getTime()
  return reservations.filter((r) => {
    if (r.status === "CANCELLED") return false
    if (!reservationBelongsToTrainer(r, trainerId)) return false
    return new Date(r.startAt).getTime() >= t0
  }).length
}

/**
 * スタッフ無効化の可否判定用に `GET /api/admin/reservations` を全件ページング取得。
 */
export async function fetchAllReservationsForAdmin(
  staffList: Staff[],
): Promise<Reservation[]> {
  return fetchAdminReservations(staffList, {
    viewMode: "month",
    anchorDate: new Date(),
  })
}

/**
 * Struct `GET /api/admin/reservations/{reservation_id}`（要ログイン Cookie）
 */
export async function fetchAdminReservationById(
  reservationId: string,
  staffList: Staff[],
): Promise<Reservation | null> {
  const url = `${ADMIN_RESERVATIONS_LIST_PATH}/${encodeURIComponent(reservationId)}`
  const res = await apiFetch(url, { method: "GET" })
  if (res.status === 401) {
    throw new Error("UNAUTHORIZED")
  }
  if (res.status === 404) {
    return null
  }
  if (!res.ok) {
    throw new Error("FETCH_FAILED")
  }
  const row = (await res.json()) as AdminReservationOut
  return mapApiReservationRowToReservation(row, staffList)
}

/**
 * `PUT /api/admin/reservations/{reservation_id}` — `trainer_id` のみ更新（他列はサーバー側で据え置き）。
 */
/** API の `trainer_id` 用。フロントの `tid_` 付き表現を除去する。 */
export function normalizeTrainerIdForApi(trainerId: string): string {
  return trainerId.startsWith("tid_") ? trainerId.slice(4) : trainerId
}

export async function putAdminReservationTrainerId(
  reservationId: string,
  trainerId: string,
): Promise<void> {
  const url = `${ADMIN_RESERVATIONS_LIST_PATH}/${encodeURIComponent(reservationId)}`
  const res = await apiFetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trainer_id: normalizeTrainerIdForApi(trainerId) }),
  })
  if (res.status === 401) {
    throw new Error("UNAUTHORIZED")
  }
  if (!res.ok) {
    const detail = await parseAdminApiErrorDetail(res)
    throw new Error(detail ?? "FETCH_FAILED")
  }
}

/**
 * `PUT /api/admin/reservations/{reservation_id}` — `start_at` のみ更新。
 * 終了時刻はサーバー側でメニュー所要時間から再計算される。
 */
export async function putAdminReservationStartAt(
  reservationId: string,
  startAt: string,
): Promise<void> {
  const url = `${ADMIN_RESERVATIONS_LIST_PATH}/${encodeURIComponent(reservationId)}`
  const res = await apiFetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ start_at: startAt }),
  })
  if (res.status === 401) {
    throw new Error("UNAUTHORIZED")
  }
  if (!res.ok) {
    const detail = await parseAdminApiErrorDetail(res)
    throw new Error(detail ?? "FETCH_FAILED")
  }
}

/**
 * `PUT /api/admin/reservations/{reservation_id}` — `notes` のみ更新（他列はサーバー側で据え置き）。
 */
export async function putAdminReservationNotes(
  reservationId: string,
  notes: string | null,
): Promise<void> {
  const url = `${ADMIN_RESERVATIONS_LIST_PATH}/${encodeURIComponent(reservationId)}`
  const res = await apiFetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes: notes ?? null }),
  })
  if (res.status === 401) {
    throw new Error("UNAUTHORIZED")
  }
  if (!res.ok) {
    throw new Error("FETCH_FAILED")
  }
}

/**
 * `PATCH /api/admin/reservations/{reservation_id}/status` — ステータスのみ更新（要ログイン Cookie）
 */
export async function patchAdminReservationStatus(
  reservationId: string,
  status: AdminReservationApiStatus,
  options?: { refundPayment?: boolean },
): Promise<void> {
  const url = `${ADMIN_RESERVATIONS_LIST_PATH}/${encodeURIComponent(reservationId)}/status`
  const res = await apiFetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, refund_payment: options?.refundPayment === true }),
  })
  if (res.status === 401) {
    throw new Error("UNAUTHORIZED")
  }
  if (!res.ok) {
    throw new Error("FETCH_FAILED")
  }
}

export async function postAdminPaymentRefund(paymentId: string): Promise<void> {
  const res = await apiFetch(`/api/admin/payments/${encodeURIComponent(paymentId)}/refund`, {
    method: "POST",
  })
  if (res.status === 401) {
    throw new Error("UNAUTHORIZED")
  }
  if (!res.ok) {
    const detail = await parseAdminApiErrorDetail(res)
    throw new Error(detail ?? "FETCH_FAILED")
  }
}

/**
 * 管理者 API のエラーレスポンスから、画面上にそのまま出せる説明文を組み立てる。
 * FastAPI: `detail` が文字列 / `ValidationError` の配列（`loc` + `msg`）などに対応。
 */
export async function parseAdminApiErrorDetail(res: Response): Promise<string | null> {
  const text = await res.text()
  if (!text.trim()) return null
  try {
    const j = JSON.parse(text) as unknown
    if (!j || typeof j !== "object") return text.trim().slice(0, 2000)
    const o = j as Record<string, unknown>
    if (typeof o.message === "string" && o.message.trim()) return o.message.trim()

    const err = o.error
    if (typeof err === "string" && err.trim()) return err.trim()

    const d = o.detail
    if (typeof d === "string") return d
    if (Array.isArray(d)) {
      const parts = d.map((item) => formatFastApiDetailItem(item))
      const s = parts.filter(Boolean).join(" ")
      return s || null
    }
    if (d && typeof d === "object") {
      return JSON.stringify(d).slice(0, 2000)
    }
  } catch {
    return text.trim().slice(0, 2000)
  }
  return null
}

function formatFastApiDetailItem(item: unknown): string {
  if (item == null) return ""
  if (typeof item === "string") return item
  if (typeof item !== "object") return String(item)
  const it = item as {
    msg?: unknown
    loc?: unknown
    type?: unknown
  }
  const msg = typeof it.msg === "string" ? it.msg : ""
  const loc = Array.isArray(it.loc)
    ? it.loc.map((x) => (typeof x === "string" || typeof x === "number" ? String(x) : "")).filter(Boolean)
    : []
  const locStr = loc.length ? loc.join(" → ") : ""
  if (locStr && msg) return `${locStr}: ${msg}`
  if (msg) return msg
  try {
    return JSON.stringify(item)
  } catch {
    return String(item)
  }
}

/** `POST /api/admin/reservations` のリクエストボディ（snake_case） */
export interface AdminCreateReservationRequestBody {
  menu_id: string
  start_at: string
  /** メニュー所要時間から算出した終了時刻（ISO 8601）。多くのバックエンドで必須 */
  end_at: string
  customer_name: string
  customer_email: string
  trainer_id?: string | null
  customer_id?: string | null
  customer_phone?: string | null
  notes?: string | null
}

/**
 * `POST /api/admin/reservations` — 管理者による代理予約作成（要ログイン Cookie）
 */
export async function postAdminReservationCreate(
  body: AdminCreateReservationRequestBody,
): Promise<{ reservation_id: string } | void> {
  const payload: Record<string, unknown> = {
    menu_id: body.menu_id,
    start_at: body.start_at,
    end_at: body.end_at,
    customer_name: body.customer_name.trim(),
    customer_email: body.customer_email.trim(),
  }
  const tid = body.trainer_id?.trim()
  if (tid) payload.trainer_id = normalizeTrainerIdForApi(tid)
  const cid = body.customer_id?.trim()
  if (cid) payload.customer_id = cid
  const phone = body.customer_phone?.trim()
  if (phone) payload.customer_phone = phone
  const notes = body.notes?.trim()
  if (notes) payload.notes = notes

  const res = await apiFetch(ADMIN_RESERVATIONS_LIST_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (res.status === 401) {
    throw new Error("UNAUTHORIZED")
  }
  if (!res.ok) {
    const detail = await parseAdminApiErrorDetail(res)
    throw new Error(detail ?? `FETCH_FAILED:${res.status}`)
  }
  const text = await res.text()
  if (!text.trim()) return
  try {
    const raw = JSON.parse(text) as unknown
    if (raw && typeof raw === "object") {
      const o = raw as Record<string, unknown>
      const idRaw = o.reservation_id ?? o.reservationId ?? o.id
      if (idRaw != null && String(idRaw).trim()) {
        return { reservation_id: String(idRaw).trim() }
      }
    }
  } catch {
    /* ignore */
  }
  return
}
