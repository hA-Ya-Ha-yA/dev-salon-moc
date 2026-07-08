import { ApiClientError, apiRequest } from "@/lib/apiClient"
import { buildSalonApiPath, resolveShopSlug } from "@/lib/shopSlug"

export type ReservationStatus = "upcoming" | "past" | "cancelled"

export interface UserReservation {
  id: string
  date: string
  time: string
  /** 施術終了（API の service_end_at）。想定時間帯表示用 */
  serviceEndAt?: string | null
  mode: string
  trainerId: string | null
  trainerName: string | null
  status: ReservationStatus
  note: string
  confirmationToken?: string
  menuId?: string
  menuName?: string
  customerName?: string
  customerEmail?: string
  customerPhone?: string | null
  /** 予約時に保存した希望決済手段（credit / paypay 等） */
  paymentMethod?: string | null
  /** reservations.payment_status（概略） */
  paymentStatus?: string | null
  /** payments テーブルがある場合の金額（円） */
  paymentAmountYen?: number | null
  paymentCurrency?: string | null
  /** payments.status */
  paymentRecordStatus?: string | null
  paymentPaidAt?: string | null
}

export interface CancellationPolicy {
  title: string
  summary: string
  detailLines: string[]
  cutoffHours: number | null
}

export interface CancellationEvaluation {
  canCancel: boolean
  reason?: string
}

export interface ReservationChangePolicy {
  title: string
  summary: string
  detailLines: string[]
  cutoffHours: number | null
}

export interface ReservationChangeEvaluation {
  canUpdate: boolean
  reason?: string
}

export interface CustomerBookingRules {
  allowSameDay: boolean
  bookingDeadlineMinutes: number
  cancellationDeadlineHours: number
  maxAdvanceDays: number
}

const RESERVATION_STORAGE_KEY = "user:reservations:v2"
const CANCELLATION_POLICY_STORAGE_KEY = "user:cancellation-policy:v2"
const RESERVATION_CHANGE_POLICY_STORAGE_KEY = "user:reservation-change-policy:v2"
const CUSTOMER_BOOKING_RULES_STORAGE_KEY = "user:booking-rules:v1"

interface StoredReservationMeta {
  id: string
  confirmationToken?: string
  mode: string
  trainerId: string | null
  trainerName: string | null
  note: string
  menuId?: string
}

interface MenuResponse {
  menu_id: string
  name: string
  duration_minutes: number
  price: number
  description: string | null
  image_url: string | null
}

export interface ReservationMenuOption {
  id: string
  name: string
  durationMinutes: number
  price: number
  description: string
  imageUrl: string
}

interface ReservationOutResponse {
  reservation_id: string
  menu_id: string
  menu_name: string | null
  start_at: string
  customer_name: string
  customer_email: string
  customer_phone: string | null
  notes: string | null
  status: string
  confirmation_token: string | null
}

interface ReservationDetailResponse {
  reservation_id: string
  menu_id?: string
  menu_name: string
  start_at: string
  service_end_at?: string | null
  customer_name?: string
  customer_email?: string
  customer_phone?: string | null
  notes: string | null
  status: string
  can_cancel: boolean
  trainer_id?: string | null
  trainer_name?: string | null
  /** API は snake_case。念のため camelCase も許容 */
  booking_type?: string | null
  bookingType?: string | null
  payment_method?: string | null
  paymentMethod?: string | null
  payment_status?: string | null
  paymentStatus?: string | null
  payment_amount_yen?: number | null
  paymentAmountYen?: number | null
  payment_currency?: string | null
  payment_record_status?: string | null
  payment_paid_at?: string | null
  confirmation_token?: string | null
}

interface AvailabilityResponse {
  date: string
  slots: { start_at: string; selectable: boolean }[]
}

interface AvailabilityDatesResponse {
  dates: string[]
}

export interface AvailabilityTimeSlot {
  time: string
  selectable: boolean
}

interface ReservationPoliciesResponse {
  cancellation: {
    title: string
    summary: string
    detail_lines: string[]
    cutoff_hours: number | null
  }
  change: {
    title: string
    summary: string
    detail_lines: string[]
    cutoff_hours: number | null
  }
}

interface CustomerBookingRulesResponse {
  allow_same_day: boolean
  booking_deadline_minutes: number
  cancellation_deadline_hours: number
  max_advance_days: number
}

const DEFAULT_CANCELLATION_POLICY: CancellationPolicy = {
  title: "キャンセルポリシー",
  summary: "現在の開発環境では暫定ポリシーを表示しています。",
  detailLines: [
    "開始24時間前までキャンセル可能（暫定）",
    "当日キャンセルはキャンセル不可（暫定）",
    "キャンセル料の詳細は正式ポリシー反映時に更新されます",
  ],
  cutoffHours: 24,
}

const DEFAULT_RESERVATION_CHANGE_POLICY: ReservationChangePolicy = {
  title: "予約変更ポリシー",
  summary: "現在の開発環境では暫定ポリシーを表示しています。",
  detailLines: [
    "開始24時間前まで日時変更可能（暫定）",
    "当日予約の変更はできません（暫定）",
    "正式な変更ルールは今後反映予定です",
  ],
  cutoffHours: 24,
}

const DEFAULT_CUSTOMER_BOOKING_RULES: CustomerBookingRules = {
  allowSameDay: false,
  bookingDeadlineMinutes: 120,
  cancellationDeadlineHours: 24,
  maxAdvanceDays: 60,
}

function safeReadStorage<T>(key: string): T | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function safeWriteStorage(key: string, value: unknown) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore storage failures in development fallback mode.
  }
}

function toDateAndTime(startAtIso: string) {
  const parsed = new Date(startAtIso)
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear()
    const month = String(parsed.getMonth() + 1).padStart(2, "0")
    const day = String(parsed.getDate()).padStart(2, "0")
    const hours = String(parsed.getHours()).padStart(2, "0")
    const minutes = String(parsed.getMinutes()).padStart(2, "0")
    return {
      date: `${year}-${month}-${day}`,
      time: `${hours}:${minutes}`,
    }
  }

  return {
    date: startAtIso.slice(0, 10),
    time: startAtIso.slice(11, 16),
  }
}

function toStatus(status: string): ReservationStatus {
  if (status === "BOOKED") return "upcoming"
  if (status === "CANCELED") return "cancelled"
  return "past"
}

function normalizeApiBookingType(detail: ReservationDetailResponse): "SHIMEI" | "OMAKASE" | undefined {
  const raw = detail.booking_type ?? detail.bookingType
  if (raw == null || raw === "") return undefined
  const u = String(raw).trim().toUpperCase()
  if (u === "SHIMEI") return "SHIMEI"
  if (u === "OMAKASE") return "OMAKASE"
  return undefined
}

function modeFromBookingTypeCode(code: "SHIMEI" | "OMAKASE"): "nomination" | "omakase" {
  return code === "SHIMEI" ? "nomination" : "omakase"
}

/** 予約入力・詳細・一覧の「想定時間」表示（開始〜service_end_at） */
export function formatReservationExpectedTimeRange(
  time: string,
  serviceEndAtIso: string | null | undefined,
): string {
  if (!time) return "未選択"
  if (!serviceEndAtIso?.trim()) return time
  const parsed = new Date(serviceEndAtIso)
  if (Number.isNaN(parsed.getTime())) return time
  const hours = String(parsed.getHours()).padStart(2, "0")
  const minutes = String(parsed.getMinutes()).padStart(2, "0")
  const end = `${hours}:${minutes}`
  return end && end !== time ? `${time}〜${end}` : time
}

/** 予約詳細で決済手段ラベル表示用 */
export function formatReservationPaymentMethod(method: string | null | undefined): string {
  if (!method?.trim()) return "—"
  const m = method.trim().toLowerCase()
  if (m === "credit") return "クレジットカード"
  if (m === "paypay") return "PayPay"
  if (m === "free") return "現地で決済"
  return method
}

/** 決済ステータス（予約側・決済レコード両方）の表示用 */
export function formatPaymentStatusLabel(status: string | null | undefined): string {
  if (!status?.trim()) return "—"
  const s = status.trim().toLowerCase()
  const map: Record<string, string> = {
    pending: "未決済",
    paid: "支払済み",
    succeeded: "支払済み",
    failed: "決済失敗",
    refunded: "返金済み",
  }
  return map[s] ?? status
}

function toReservation(
  detail: ReservationDetailResponse,
  meta?: StoredReservationMeta,
  fallbackMenuName?: string,
): UserReservation {
  const { date, time } = toDateAndTime(detail.start_at)
  const bookingCode = normalizeApiBookingType(detail)
  const modeFromApi = bookingCode ? modeFromBookingTypeCode(bookingCode) : undefined
  return {
    id: detail.reservation_id,
    date,
    time,
    serviceEndAt: detail.service_end_at ?? null,
    mode: modeFromApi ?? meta?.mode ?? "omakase",
    trainerId: detail.trainer_id ?? meta?.trainerId ?? null,
    trainerName: detail.trainer_name ?? meta?.trainerName ?? null,
    status: toStatus(detail.status),
    note: detail.notes ?? meta?.note ?? "",
    confirmationToken: detail.confirmation_token ?? meta?.confirmationToken,
    menuId: detail.menu_id ?? meta?.menuId,
    menuName: detail.menu_name || fallbackMenuName,
    customerName: detail.customer_name,
    customerEmail: detail.customer_email,
    customerPhone: detail.customer_phone ?? null,
    paymentMethod: detail.payment_method ?? detail.paymentMethod ?? null,
    paymentStatus: detail.payment_status ?? detail.paymentStatus ?? null,
    paymentAmountYen:
      detail.payment_amount_yen ?? detail.paymentAmountYen ?? null,
    paymentCurrency: detail.payment_currency ?? null,
    paymentRecordStatus: detail.payment_record_status ?? null,
    paymentPaidAt: detail.payment_paid_at ?? null,
  }
}

function loadReservationMeta() {
  const stored = safeReadStorage<StoredReservationMeta[]>(RESERVATION_STORAGE_KEY)
  if (stored && Array.isArray(stored)) {
    return stored.filter((item) => typeof item?.id === "string" && item.id.length > 0)
  }
  safeWriteStorage(RESERVATION_STORAGE_KEY, [])
  return []
}

function saveReservationMeta(meta: StoredReservationMeta[]) {
  safeWriteStorage(RESERVATION_STORAGE_KEY, meta)
}

function mergeReservationMeta(entries: StoredReservationMeta[]) {
  if (entries.length === 0) return
  const current = loadReservationMeta()
  const merged = [...entries]
  for (const item of current) {
    if (merged.some((entry) => entry.id === item.id)) continue
    merged.push(item)
  }
  saveReservationMeta(merged)
}

function toReservationStart(date: string, time: string) {
  return new Date(`${date}T${time}:00`)
}

function toReservationStartIso(date: string, time: string) {
  return `${date}T${time}:00+09:00`
}

async function resolveDefaultMenu(shopSlug?: string): Promise<MenuResponse> {
  const resolvedShopSlug = resolveShopSlug(shopSlug)
  if (!resolvedShopSlug) {
    throw new Error("店舗情報が見つかりませんでした。")
  }
  const menus = await apiRequest<MenuResponse[]>(buildSalonApiPath(resolvedShopSlug, "/menus"))
  const firstMenu = menus[0]
  if (!firstMenu) {
    throw new Error("予約可能なメニューが見つかりませんでした。")
  }
  return firstMenu
}

/** 新規予約作成・決済 intent で同じメニュー解決ルールに揃える */
async function resolveMenuForNewReservation(
  resolvedShopSlug: string,
  opts: { preferredMenuId?: string; mode: string; trainerId: string | null },
): Promise<MenuResponse> {
  let menuId = opts.preferredMenuId?.trim() || ""
  if (!menuId && opts.mode === "nomination" && opts.trainerId?.trim()) {
    const trainerMenus = await fetchReservationMenus(resolvedShopSlug, opts.trainerId)
    menuId = trainerMenus[0]?.id ?? ""
  }
  if (menuId) {
    const allMenus = await apiRequest<MenuResponse[]>(buildSalonApiPath(resolvedShopSlug, "/menus"))
    const hit = allMenus.find((m) => m.menu_id === menuId)
    if (hit) return hit
    throw new Error("選択したメニューが見つかりませんでした。")
  }
  return resolveDefaultMenu(resolvedShopSlug)
}

export interface ReservationCheckoutMenu {
  menu_id: string
  name: string
  duration_minutes: number
  price: number
}

/** 入力・確認画面で表示する予約対象メニュー（料金・所要時間の解決） */
export async function fetchMenuForReservationCheckout(payload: {
  shopSlug?: string
  preferredMenuId?: string
  mode: string
  trainerId: string | null
}): Promise<ReservationCheckoutMenu> {
  const resolved = resolveShopSlug(payload.shopSlug)
  if (!resolved) {
    throw new Error("店舗情報が見つかりませんでした。")
  }
  const m = await resolveMenuForNewReservation(resolved, {
    preferredMenuId: payload.preferredMenuId,
    mode: payload.mode,
    trainerId: payload.trainerId,
  })
  return {
    menu_id: m.menu_id,
    name: m.name,
    duration_minutes: m.duration_minutes,
    price: m.price,
  }
}

export async function fetchReservationMenus(
  shopSlug?: string,
  trainerId?: string,
): Promise<ReservationMenuOption[]> {
  const resolvedShopSlug = resolveShopSlug(shopSlug)
  if (!resolvedShopSlug) return []
  const trainerQuery = trainerId ? `?trainer_id=${encodeURIComponent(trainerId)}` : ""
  const menus = await apiRequest<MenuResponse[]>(
    `${buildSalonApiPath(resolvedShopSlug, "/menus")}${trainerQuery}`,
  )
  return menus.map((menu) => ({
    id: menu.menu_id,
    name: menu.name,
    durationMinutes: menu.duration_minutes,
    price: menu.price,
    description: menu.description ?? "",
    imageUrl: menu.image_url ?? "",
  }))
}

const RESERVATION_LOOKUP_TOKEN_KEY = "user:reservation-lookup-token"

export function getReservationLookupToken(shopSlug?: string): string | null {
  const resolvedShopSlug = resolveShopSlug(shopSlug)
  if (!resolvedShopSlug) return null
  try {
    return sessionStorage.getItem(`${RESERVATION_LOOKUP_TOKEN_KEY}:${resolvedShopSlug}`)
  } catch {
    return null
  }
}

export function setReservationLookupToken(shopSlug: string | undefined, token: string): void {
  const resolvedShopSlug = resolveShopSlug(shopSlug)
  if (!resolvedShopSlug) return
  try {
    sessionStorage.setItem(`${RESERVATION_LOOKUP_TOKEN_KEY}:${resolvedShopSlug}`, token)
  } catch {
    // ignore
  }
}

export function clearReservationLookupToken(shopSlug?: string): void {
  const resolvedShopSlug = resolveShopSlug(shopSlug)
  if (!resolvedShopSlug) return
  try {
    sessionStorage.removeItem(`${RESERVATION_LOOKUP_TOKEN_KEY}:${resolvedShopSlug}`)
  } catch {
    // ignore
  }
}

interface ReservationLookupOtpRequestResponse {
  challenge_id: string
  masked_destination: string
  message: string
}

interface ReservationLookupOtpVerifyResponse {
  lookup_token: string
  expires_in_minutes: number
}

export async function requestReservationLookupOtp(payload: {
  shopSlug?: string
  email?: string
  phone?: string
}): Promise<ReservationLookupOtpRequestResponse> {
  const resolvedShopSlug = resolveShopSlug(payload.shopSlug)
  if (!resolvedShopSlug) {
    throw new Error("店舗情報が見つかりませんでした。")
  }
  return apiRequest<ReservationLookupOtpRequestResponse>(
    buildSalonApiPath(resolvedShopSlug, "/reservations/lookup/request-otp"),
    {
      method: "POST",
      body: {
        email: payload.email?.trim() || undefined,
        phone: payload.phone?.trim() || undefined,
      },
    },
  )
}

export async function verifyReservationLookupOtp(payload: {
  shopSlug?: string
  challengeId: string
  code: string
}): Promise<ReservationLookupOtpVerifyResponse> {
  const resolvedShopSlug = resolveShopSlug(payload.shopSlug)
  if (!resolvedShopSlug) {
    throw new Error("店舗情報が見つかりませんでした。")
  }
  return apiRequest<ReservationLookupOtpVerifyResponse>(
    buildSalonApiPath(resolvedShopSlug, "/reservations/lookup/verify-otp"),
    {
      method: "POST",
      body: {
        challenge_id: payload.challengeId,
        code: payload.code.trim(),
      },
    },
  )
}

export async function fetchReservationsByContact(payload: {
  shopSlug?: string
  lookupToken: string
}): Promise<UserReservation[]> {
  const resolvedShopSlug = resolveShopSlug(payload.shopSlug)
  if (!resolvedShopSlug) {
    throw new Error("店舗情報が見つかりませんでした。")
  }
  const details = await apiRequest<ReservationDetailResponse[]>(
    buildSalonApiPath(resolvedShopSlug, "/reservations/lookup"),
    {
      method: "GET",
      bearerToken: payload.lookupToken,
    },
  )
  const reservations = details.map((detail) => toReservation(detail))
  mergeReservationMeta(
    reservations.map((reservation) => ({
      id: reservation.id,
      confirmationToken: reservation.confirmationToken,
      mode: reservation.mode,
      trainerId: reservation.trainerId,
      trainerName: reservation.trainerName,
      note: reservation.note,
      menuId: reservation.menuId,
    })),
  )
  return reservations.sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
}

export async function fetchUserReservationById(
  reservationId: string,
  shopSlug?: string,
): Promise<UserReservation | null> {
  const resolvedShopSlug = resolveShopSlug(shopSlug)
  try {
    const detail = await apiRequest<ReservationDetailResponse>(`/api/my/reservations/${reservationId}`)
    const meta = loadReservationMeta().find((item) => item.id === reservationId)
    return toReservation(detail, meta)
  } catch {
    const meta = loadReservationMeta().find((item) => item.id === reservationId && !!item.confirmationToken)
    if (!meta?.confirmationToken) return null
    if (!resolvedShopSlug) return null
    try {
      const detail = await apiRequest<ReservationDetailResponse>(
        buildSalonApiPath(resolvedShopSlug, `/reservations/${meta.confirmationToken}`),
      )
      return toReservation(detail, meta)
    } catch {
      return null
    }
  }
}

export async function fetchCancellationPolicy(): Promise<CancellationPolicy> {
  const policies = await fetchReservationPolicies()
  return policies.cancellation
}

export async function fetchReservationChangePolicy(): Promise<ReservationChangePolicy> {
  const policies = await fetchReservationPolicies()
  return policies.change
}

export async function fetchReservationPolicies(): Promise<{
  cancellation: CancellationPolicy
  change: ReservationChangePolicy
}> {
  try {
    const response = await apiRequest<ReservationPoliciesResponse>("/api/my/reservation-policies")
    const cancellation: CancellationPolicy = {
      title: response.cancellation.title,
      summary: response.cancellation.summary,
      detailLines: response.cancellation.detail_lines,
      cutoffHours: response.cancellation.cutoff_hours,
    }
    const change: ReservationChangePolicy = {
      title: response.change.title,
      summary: response.change.summary,
      detailLines: response.change.detail_lines,
      cutoffHours: response.change.cutoff_hours,
    }
    safeWriteStorage(CANCELLATION_POLICY_STORAGE_KEY, cancellation)
    safeWriteStorage(RESERVATION_CHANGE_POLICY_STORAGE_KEY, change)
    return { cancellation, change }
  } catch {
    const storedCancellation = safeReadStorage<CancellationPolicy>(CANCELLATION_POLICY_STORAGE_KEY)
    const stored = safeReadStorage<ReservationChangePolicy>(RESERVATION_CHANGE_POLICY_STORAGE_KEY)
    if (storedCancellation && stored) {
      return Promise.resolve({ cancellation: storedCancellation, change: stored })
    }
    safeWriteStorage(CANCELLATION_POLICY_STORAGE_KEY, DEFAULT_CANCELLATION_POLICY)
    safeWriteStorage(RESERVATION_CHANGE_POLICY_STORAGE_KEY, DEFAULT_RESERVATION_CHANGE_POLICY)
    return Promise.resolve({
      cancellation: DEFAULT_CANCELLATION_POLICY,
      change: DEFAULT_RESERVATION_CHANGE_POLICY,
    })
  }
}

export function evaluateReservationCancellation(
  reservation: UserReservation,
  policy: CancellationPolicy,
  nowDate = new Date(),
): CancellationEvaluation {
  if (reservation.status !== "upcoming") {
    return { canCancel: false, reason: "この予約はキャンセル対象ではありません。" }
  }

  if (policy.cutoffHours === null) {
    return { canCancel: true }
  }

  const reservationStart = toReservationStart(reservation.date, reservation.time)
  const cutoff = reservationStart.getTime() - policy.cutoffHours * 60 * 60 * 1000
  if (nowDate.getTime() > cutoff) {
    return {
      canCancel: false,
      reason: `開始${policy.cutoffHours}時間前を過ぎているためキャンセルできません。`,
    }
  }

  return { canCancel: true }
}

export async function fetchCustomerBookingRules(shopSlug?: string): Promise<CustomerBookingRules> {
  const resolvedShopSlug = resolveShopSlug(shopSlug)
  try {
    const path = resolvedShopSlug
      ? buildSalonApiPath(resolvedShopSlug, "/booking-rules")
      : "/api/my/booking-rules"
    const response = await apiRequest<CustomerBookingRulesResponse>(path)
    const rules: CustomerBookingRules = {
      allowSameDay: response.allow_same_day,
      bookingDeadlineMinutes: response.booking_deadline_minutes,
      cancellationDeadlineHours: response.cancellation_deadline_hours,
      maxAdvanceDays: response.max_advance_days,
    }
    safeWriteStorage(CUSTOMER_BOOKING_RULES_STORAGE_KEY, rules)
    return rules
  } catch {
    const stored = safeReadStorage<CustomerBookingRules>(CUSTOMER_BOOKING_RULES_STORAGE_KEY)
    if (stored) {
      return Promise.resolve(stored)
    }
    safeWriteStorage(CUSTOMER_BOOKING_RULES_STORAGE_KEY, DEFAULT_CUSTOMER_BOOKING_RULES)
    return Promise.resolve(DEFAULT_CUSTOMER_BOOKING_RULES)
  }
}

export function evaluateReservationUpdate(
  reservation: UserReservation,
  policy: ReservationChangePolicy,
  nowDate = new Date(),
): ReservationChangeEvaluation {
  if (reservation.status !== "upcoming") {
    return { canUpdate: false, reason: "この予約は変更対象ではありません。" }
  }

  if (policy.cutoffHours === null) {
    return { canUpdate: true }
  }

  const reservationStart = toReservationStart(reservation.date, reservation.time)
  const cutoff = reservationStart.getTime() - policy.cutoffHours * 60 * 60 * 1000
  if (nowDate.getTime() > cutoff) {
    return {
      canUpdate: false,
      reason: `開始${policy.cutoffHours}時間前を過ぎているため予約変更できません。`,
    }
  }

  return { canUpdate: true }
}

export async function cancelUserReservation(
  reservationId: string,
  shopSlug?: string,
): Promise<{ ok: true; reservation: UserReservation } | { ok: false; error: string }> {
  try {
    const detail = await apiRequest<ReservationDetailResponse>(`/api/my/reservations/${reservationId}/cancel`, {
      method: "POST",
      body: {},
    })
    const targetMeta = loadReservationMeta().find((reservation) => reservation.id === reservationId)
    const updated = toReservation(detail, targetMeta)
    return { ok: true, reservation: updated }
  } catch (error) {
    const resolvedShopSlug = resolveShopSlug(shopSlug)
    const targetMeta = loadReservationMeta().find(
      (reservation) => reservation.id === reservationId && !!reservation.confirmationToken,
    )
    if (resolvedShopSlug && targetMeta?.confirmationToken) {
      try {
        const detail = await apiRequest<ReservationDetailResponse>(
          buildSalonApiPath(resolvedShopSlug, `/reservations/${targetMeta.confirmationToken}/cancel`),
          {
            method: "POST",
            body: {},
          },
        )
        return { ok: true, reservation: toReservation(detail, targetMeta) }
      } catch (fallbackError) {
        if (fallbackError instanceof ApiClientError) {
          return { ok: false, error: fallbackError.message }
        }
        return { ok: false, error: "予約キャンセルに失敗しました。" }
      }
    }
    if (error instanceof ApiClientError) {
      return { ok: false, error: error.message }
    }
    return { ok: false, error: "予約キャンセルに失敗しました。" }
  }
}

interface UpdateReservationPayload {
  reservationId: string
  shopSlug?: string
  date: string
  time: string
  mode: string
  trainerId: string | null
  trainerName: string | null
  note: string
  fullName?: string
  email?: string
  phone?: string
}

export async function updateUserReservation(
  payload: UpdateReservationPayload,
): Promise<{ ok: true; reservation: UserReservation } | { ok: false; error: string }> {
  const allMeta = loadReservationMeta()
  const targetMeta = allMeta.find((reservation) => reservation.id === payload.reservationId)

  const targetReservation = await fetchUserReservationById(payload.reservationId)
  if (!targetReservation || targetReservation.status !== "upcoming") {
    return Promise.resolve({ ok: false, error: "この予約は変更できません。" })
  }

  const policy = await fetchReservationChangePolicy()
  const evaluation = evaluateReservationUpdate(targetReservation, policy)
  if (!evaluation.canUpdate) {
    return Promise.resolve({
      ok: false,
      error: evaluation.reason ?? "予約変更ポリシーにより予約変更できません。",
    })
  }

  try {
    const detail = await apiRequest<ReservationDetailResponse>(`/api/my/reservations/${payload.reservationId}`, {
      method: "PUT",
      body: {
        start_at: toReservationStartIso(payload.date, payload.time),
        customer_name: payload.fullName || undefined,
        customer_email: payload.email || undefined,
        customer_phone: payload.phone || undefined,
        notes: payload.note || undefined,
      },
    })

    const nextMeta: StoredReservationMeta = {
      id: payload.reservationId,
      confirmationToken: targetMeta?.confirmationToken,
      mode: payload.mode,
      trainerId: payload.trainerId,
      trainerName: payload.trainerName,
      note: payload.note,
      menuId: targetMeta?.menuId,
    }
    saveReservationMeta([
      nextMeta,
      ...allMeta.filter((item) => item.id !== payload.reservationId),
    ])

    return { ok: true, reservation: toReservation(detail, nextMeta) }
  } catch (error) {
    const resolvedShopSlug = resolveShopSlug(payload.shopSlug)
    if (resolvedShopSlug && targetMeta?.confirmationToken) {
      try {
        const detail = await apiRequest<ReservationDetailResponse>(
          buildSalonApiPath(resolvedShopSlug, `/reservations/${targetMeta.confirmationToken}`),
          {
            method: "PUT",
            body: {
              start_at: toReservationStartIso(payload.date, payload.time),
              customer_name: payload.fullName || undefined,
              customer_email: payload.email || undefined,
              customer_phone: payload.phone || undefined,
              notes: payload.note || undefined,
            },
          },
        )
        const nextMeta: StoredReservationMeta = {
          id: payload.reservationId,
          confirmationToken: targetMeta.confirmationToken,
          mode: payload.mode,
          trainerId: payload.trainerId,
          trainerName: payload.trainerName,
          note: payload.note,
          menuId: targetMeta?.menuId,
        }
        saveReservationMeta([
          nextMeta,
          ...allMeta.filter((item) => item.id !== payload.reservationId),
        ])
        return { ok: true, reservation: toReservation(detail, nextMeta) }
      } catch (fallbackError) {
        if (fallbackError instanceof ApiClientError) {
          return { ok: false, error: fallbackError.message }
        }
        return { ok: false, error: "予約変更に失敗しました。" }
      }
    }
    if (error instanceof ApiClientError) {
      return { ok: false, error: error.message }
    }
    return { ok: false, error: "予約変更に失敗しました。" }
  }
}

interface CreateReservationPayload {
  date: string
  time: string
  mode: string
  trainerId: string | null
  trainerName: string | null
  note: string
  fullName?: string
  email?: string
  phone?: string
  preferredMenuId?: string
  shopSlug?: string
  /** credit / paypay 等（バックエンドの payment_method に保存） */
  paymentMethod?: string
}

export async function createUserReservation(
  payload: CreateReservationPayload,
): Promise<{ ok: true; reservation: UserReservation } | { ok: false; error: string }> {
  const resolvedShopSlug = resolveShopSlug(payload.shopSlug)
  if (!resolvedShopSlug) {
    return { ok: false, error: "店舗情報が見つかりません。" }
  }
  if (payload.mode === "nomination" && !payload.trainerId?.trim()) {
    return { ok: false, error: "指名予約ではトレーナーを選択してください。" }
  }
  try {
    const menu = await resolveMenuForNewReservation(resolvedShopSlug, {
      preferredMenuId: payload.preferredMenuId,
      mode: payload.mode,
      trainerId: payload.trainerId,
    })

    const bookingType = payload.mode === "nomination" ? "SHIMEI" : "OMAKASE"
    const data = await apiRequest<ReservationOutResponse>(buildSalonApiPath(resolvedShopSlug, "/reservations"), {
      method: "POST",
      body: {
        menu_id: menu.menu_id,
        start_at: toReservationStartIso(payload.date, payload.time),
        customer_name: payload.fullName || undefined,
        customer_email: payload.email || undefined,
        customer_phone: payload.phone || undefined,
        notes: payload.note || undefined,
        booking_type: bookingType,
        trainer_id:
          payload.mode === "nomination" && payload.trainerId ? payload.trainerId : undefined,
        payment_method: payload.paymentMethod?.trim() || undefined,
      },
    })

    const meta = loadReservationMeta()
    const nextMeta: StoredReservationMeta[] = [
      {
        id: data.reservation_id,
        confirmationToken: data.confirmation_token ?? undefined,
        mode: payload.mode,
        trainerId: payload.trainerId,
        trainerName: payload.trainerName,
        note: payload.note,
        menuId: data.menu_id,
      },
      ...meta.filter((item) => item.id !== data.reservation_id),
    ]
    saveReservationMeta(nextMeta)
    let detail: ReservationDetailResponse
    try {
      detail = await apiRequest<ReservationDetailResponse>(`/api/my/reservations/${data.reservation_id}`)
    } catch {
      if (!data.confirmation_token) {
        return { ok: false, error: "予約詳細の取得に失敗しました。" }
      }
      detail = await apiRequest<ReservationDetailResponse>(
        buildSalonApiPath(resolvedShopSlug, `/reservations/${data.confirmation_token}`),
      )
    }
    return {
      ok: true,
      reservation: toReservation(detail, nextMeta[0], data.menu_name ?? undefined),
    }
  } catch (error) {
    if (error instanceof ApiClientError) {
      return { ok: false, error: error.message }
    }
    return { ok: false, error: "予約作成に失敗しました。" }
  }
}

interface ReservationPaymentIntentResponse {
  payment_intent_id: string
  client_secret: string
  publishable_key: string
  amount_yen: number
  currency: string
}

interface ReservationFinalizeResponse {
  reservation_id: string
  confirmation_token: string | null
  payment_id: string
  payment_status: string
  payment_method: string | null
}

interface PayPayCheckoutResponse {
  payment_id: string
  merchant_payment_id: string
  redirect_url: string
  payment_status: string
}

function normalizeReservationPaymentIntentError(error: unknown): string {
  if (error instanceof ApiClientError) {
    const message = error.message.trim()
    if (message === "Salon Stripe Connect account is not connected") {
      return "この店舗では現在オンライン決済を利用できません。別の決済方法を選択してください。"
    }
    if (error.status === 404 && message.toLowerCase().includes("card")) {
      return "カードが見つかりません。別のカードを選択してください。"
    }
    return error.message
  }
  if (error instanceof Error) return error.message
  return "決済の初期化に失敗しました。"
}

export async function createReservationPaymentIntent(
  payload: {
    shopSlug?: string
    menuId?: string
    mode: string
    trainerId: string | null
    date: string
    time: string
  },
): Promise<
  | {
      ok: true
      skipPayment: true
      amountYen: 0
    }
  | {
      ok: true
      skipPayment?: false
      paymentIntentId: string
      clientSecret: string
      publishableKey: string
      amountYen: number
      currency: string
    }
  | { ok: false; error: string }
> {
  const resolvedShopSlug = resolveShopSlug(payload.shopSlug)
  if (!resolvedShopSlug) return { ok: false, error: "店舗情報が見つかりません。" }
  try {
    const menu = await resolveMenuForNewReservation(resolvedShopSlug, {
      preferredMenuId: payload.menuId,
      mode: payload.mode,
      trainerId: payload.trainerId,
    })
    if (menu.price <= 0) {
      return { ok: true, skipPayment: true, amountYen: 0 }
    }
    const response = await apiRequest<ReservationPaymentIntentResponse>("/api/payments/reservation-intent", {
      method: "POST",
      body: {
        shop_slug: resolvedShopSlug,
        menu_id: menu.menu_id,
        start_at: toReservationStartIso(payload.date, payload.time),
      },
    })
    return {
      ok: true,
      paymentIntentId: response.payment_intent_id,
      clientSecret: response.client_secret,
      publishableKey: response.publishable_key,
      amountYen: response.amount_yen,
      currency: response.currency,
    }
  } catch (error) {
    return { ok: false, error: normalizeReservationPaymentIntentError(error) }
  }
}

export async function finalizePaidUserReservation(
  payload: CreateReservationPayload & {
    paymentIntentId: string
  },
): Promise<{ ok: true; reservation: UserReservation } | { ok: false; error: string }> {
  const resolvedShopSlug = resolveShopSlug(payload.shopSlug)
  if (!resolvedShopSlug) {
    return { ok: false, error: "店舗情報が見つかりません。" }
  }
  try {
    const menu = await resolveMenuForNewReservation(resolvedShopSlug, {
      preferredMenuId: payload.preferredMenuId,
      mode: payload.mode,
      trainerId: payload.trainerId,
    })
    const bookingType = payload.mode === "nomination" ? "SHIMEI" : "OMAKASE"

    const finalized = await apiRequest<ReservationFinalizeResponse>("/api/payments/reservation-finalize", {
      method: "POST",
      body: {
        shop_slug: resolvedShopSlug,
        menu_id: menu.menu_id,
        start_at: toReservationStartIso(payload.date, payload.time),
        payment_intent_id: payload.paymentIntentId,
        customer_name: payload.fullName || undefined,
        customer_email: payload.email || undefined,
        customer_phone: payload.phone || undefined,
        notes: payload.note || undefined,
        booking_type: bookingType,
        trainer_id:
          payload.mode === "nomination" && payload.trainerId ? payload.trainerId : undefined,
        payment_method: payload.paymentMethod?.trim() || "credit",
      },
    })

    const meta = loadReservationMeta()
    const nextMeta: StoredReservationMeta[] = [
      {
        id: finalized.reservation_id,
        confirmationToken: finalized.confirmation_token ?? undefined,
        mode: payload.mode,
        trainerId: payload.trainerId,
        trainerName: payload.trainerName,
        note: payload.note,
        menuId: menu.menu_id,
      },
      ...meta.filter((item) => item.id !== finalized.reservation_id),
    ]
    saveReservationMeta(nextMeta)

    let detail: ReservationDetailResponse
    try {
      detail = await apiRequest<ReservationDetailResponse>(`/api/my/reservations/${finalized.reservation_id}`)
    } catch {
      if (!finalized.confirmation_token) {
        return { ok: false, error: "予約詳細の取得に失敗しました。" }
      }
      detail = await apiRequest<ReservationDetailResponse>(
        buildSalonApiPath(resolvedShopSlug, `/reservations/${finalized.confirmation_token}`),
      )
    }
    return {
      ok: true,
      reservation: toReservation(detail, nextMeta[0]),
    }
  } catch (error) {
    if (error instanceof ApiClientError) return { ok: false, error: error.message }
    return { ok: false, error: "予約確定に失敗しました。" }
  }
}

export async function startPayPayCheckout(
  payload: CreateReservationPayload,
): Promise<
  | { ok: true; paymentId: string; merchantPaymentId: string; redirectUrl: string }
  | { ok: false; error: string }
> {
  const resolvedShopSlug = resolveShopSlug(payload.shopSlug)
  if (!resolvedShopSlug) {
    return { ok: false, error: "店舗情報が見つかりません。" }
  }
  try {
    const menu = await resolveMenuForNewReservation(resolvedShopSlug, {
      preferredMenuId: payload.preferredMenuId,
      mode: payload.mode,
      trainerId: payload.trainerId,
    })
    const bookingType = payload.mode === "nomination" ? "SHIMEI" : "OMAKASE"
    const response = await apiRequest<PayPayCheckoutResponse>("/api/payments/paypay/checkout", {
      method: "POST",
      body: {
        shop_slug: resolvedShopSlug,
        menu_id: menu.menu_id,
        start_at: toReservationStartIso(payload.date, payload.time),
        customer_name: payload.fullName || undefined,
        customer_email: payload.email || undefined,
        customer_phone: payload.phone || undefined,
        notes: payload.note || undefined,
        booking_type: bookingType,
        trainer_id:
          payload.mode === "nomination" && payload.trainerId ? payload.trainerId : undefined,
        payment_method: payload.paymentMethod?.trim() || "paypay",
      },
    })

    return {
      ok: true,
      paymentId: response.payment_id,
      merchantPaymentId: response.merchant_payment_id,
      redirectUrl: response.redirect_url,
    }
  } catch (error) {
    if (error instanceof ApiClientError) return { ok: false, error: error.message }
    if (error instanceof Error) return { ok: false, error: error.message }
    return { ok: false, error: "PayPay決済の開始に失敗しました。" }
  }
}

export async function finalizePayPayReservation(
  payload: {
    merchantPaymentId: string
    mode?: string
    trainerId?: string | null
    trainerName?: string | null
    note?: string
    menuId?: string
    shopSlug?: string
  },
): Promise<{ ok: true; reservation: UserReservation } | { ok: false; error: string }> {
  try {
    const finalized = await apiRequest<ReservationFinalizeResponse>("/api/payments/paypay/finalize", {
      method: "POST",
      body: {
        merchant_payment_id: payload.merchantPaymentId,
      },
    })

    const meta = loadReservationMeta()
    const nextMeta: StoredReservationMeta[] = [
      {
        id: finalized.reservation_id,
        confirmationToken: finalized.confirmation_token ?? undefined,
        mode: payload.mode ?? "omakase",
        trainerId: payload.trainerId ?? null,
        trainerName: payload.trainerName ?? null,
        note: payload.note ?? "",
        menuId: payload.menuId,
      },
      ...meta.filter((item) => item.id !== finalized.reservation_id),
    ]
    saveReservationMeta(nextMeta)

    let detail: ReservationDetailResponse
    try {
      detail = await apiRequest<ReservationDetailResponse>(`/api/my/reservations/${finalized.reservation_id}`)
    } catch {
      if (!finalized.confirmation_token) {
        return { ok: false, error: "予約詳細の取得に失敗しました。" }
      }
      const resolvedShopSlug = resolveShopSlug(payload.shopSlug)
      if (!resolvedShopSlug) {
        return { ok: false, error: "店舗情報が見つかりません。" }
      }
      detail = await apiRequest<ReservationDetailResponse>(
        buildSalonApiPath(resolvedShopSlug, `/reservations/${finalized.confirmation_token}`),
      )
    }
    return {
      ok: true,
      reservation: toReservation(detail, nextMeta[0]),
    }
  } catch (error) {
    if (error instanceof ApiClientError) return { ok: false, error: error.message }
    if (error instanceof Error) return { ok: false, error: error.message }
    return { ok: false, error: "PayPay決済確定に失敗しました。" }
  }
}

export async function fetchAvailableTimeSlots(
  date: string,
  shopSlug?: string,
  preferredMenuId?: string,
  trainerId?: string,
  excludeReservationId?: string,
): Promise<AvailabilityTimeSlot[]> {
  if (!date) return []
  const resolvedShopSlug = resolveShopSlug(shopSlug)
  if (!resolvedShopSlug) return []
  const menu = await resolveMenuForNewReservation(resolvedShopSlug, {
    preferredMenuId,
    mode: trainerId ? "nomination" : "omakase",
    trainerId: trainerId?.trim() || null,
  })
  const trainerQuery = trainerId ? `&trainer_id=${encodeURIComponent(trainerId)}` : ""
  const excludeId = excludeReservationId?.trim()
  const excludeQuery = excludeId ? `&exclude_reservation_id=${encodeURIComponent(excludeId)}` : ""
  const data = await apiRequest<AvailabilityResponse>(
    `${buildSalonApiPath(
      resolvedShopSlug,
      "/availability",
    )}?menu_id=${encodeURIComponent(menu.menu_id)}&date=${encodeURIComponent(date)}${trainerQuery}${excludeQuery}`,
  )
  return data.slots.map((slot) => ({
    time: slot.start_at.slice(11, 16),
    selectable: slot.selectable,
  }))
}

export async function fetchShiftAvailableDates(
  fromDate: string,
  toDate: string,
  shopSlug?: string,
  preferredMenuId?: string,
  trainerId?: string,
  excludeReservationId?: string,
): Promise<string[]> {
  if (!fromDate || !toDate) return []
  const resolvedShopSlug = resolveShopSlug(shopSlug)
  if (!resolvedShopSlug) return []
  const menu = await resolveMenuForNewReservation(resolvedShopSlug, {
    preferredMenuId,
    mode: trainerId ? "nomination" : "omakase",
    trainerId: trainerId?.trim() || null,
  })
  const trainerQuery = trainerId ? `&trainer_id=${encodeURIComponent(trainerId)}` : ""
  const excludeId = excludeReservationId?.trim()
  const excludeQuery = excludeId ? `&exclude_reservation_id=${encodeURIComponent(excludeId)}` : ""
  const data = await apiRequest<AvailabilityDatesResponse>(
    `${buildSalonApiPath(
      resolvedShopSlug,
      "/availability-dates",
    )}?menu_id=${encodeURIComponent(menu.menu_id)}&from_date=${encodeURIComponent(
      fromDate,
    )}&to_date=${encodeURIComponent(toDate)}${trainerQuery}${excludeQuery}`,
  )
  return Array.isArray(data.dates) ? data.dates : []
}
