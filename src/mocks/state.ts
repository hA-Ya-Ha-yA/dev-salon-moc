/**
 * フロントエンド専用モックの状態管理。
 * すべての API 呼び出しは `src/mocks/install.ts` の `fetch` インターセプタ経由でここを読み書きする。
 * データ整合性は最低限で、画面操作を成立させるための「ゆるいモック」の位置付け。
 *
 * localStorage キー: `saas_frontend_mock_state_v1`
 */

const STORAGE_KEY = "saas_frontend_mock_state_v1"
const DEFAULT_SHOP_SLUG = "sample-salon-2026"

export type MockAdminSession = {
  admin_id: string
  email: string
  name: string
  role: "owner" | "staff"
  salon_id: string
  avatar_url: string | null
} | null

export type MockCustomerSession = {
  user_id: string
  email: string
  name: string
  shop_slug: string
} | null

export type MockSalon = {
  salon_id: string
  slug: string
  salon_name: string
  description: string | null
  address: string | null
  phone: string | null
  logo_url: string | null
  cover_image_url: string | null
  instagram_url: string | null
  line_url: string | null
  website_url: string | null
  theme_color: string
  booking_page_message: string | null
  cancellation_policy_text: string | null
  timezone: string
}

export type MockMenu = {
  menu_id: string
  name: string
  duration_minutes: number
  price: number
  description: string | null
  image_url: string | null
  is_public: boolean
  is_archived: boolean
}

export type MockTrainer = {
  trainer_id: string
  name: string
  color: string
  description: string | null
  image_url: string | null
  display_order: number
  admin_id: string | null
  menu_ids: string[]
  is_active: boolean
}

export type MockShift = {
  shift_id: string
  trainer_id: string
  date: string /* YYYY-MM-DD */
  start_time: string /* HH:mm */
  end_time: string /* HH:mm */
}

export type MockReservation = {
  reservation_id: string
  menu_id: string | null
  menu_name: string | null
  start_at: string /* ISO */
  service_end_at: string /* ISO */
  customer_name: string
  customer_email: string
  customer_phone: string | null
  notes: string | null
  status: "BOOKED" | "CANCELED" | "DONE" | "NOSHOW"
  customer_id: string | null
  trainer_id: string | null
  trainer_name: string | null
  booking_type: "SHIMEI" | "OMAKASE" | null
  source: string | null
  payment_status: string | null
  payment_method: string | null
  payment_id: string | null
  payment_provider: string | null
  payment_amount_yen: number | null
  payment_currency: string | null
  payment_record_status: string | null
  payment_refund_amount: number | null
  payment_paid_at: string | null
  created_at: string
  confirmation_token: string | null
}

export type MockAdminUser = {
  admin_id: string
  name: string
  email: string
  password: string
  role: "owner" | "staff"
  is_active: boolean
  avatar_url: string | null
  salon_id: string
}

export type MockCustomerUser = {
  user_id: string
  email: string
  password: string
  name: string
  phone: string | null
  shop_slug: string
}

export type MockBusinessHour = {
  day_of_week: number
  start_time: string
  end_time: string
  is_closed: boolean
}

export type MockBookingRules = {
  allow_same_day: boolean
  booking_deadline_minutes: number
  buffer_minutes: number
  slot_increment_minutes: number
  cancellation_deadline_hours: number
  max_advance_days: number
}

export type MockSignupToken = {
  token: string
  email: string
  used: boolean
  expires_at: string
}

export type MockOtpChallenge = {
  challenge_id: string
  code: string
  destination: string
  created_at: string
}

export type MockLookupToken = {
  token: string
  shop_slug: string
  contact: string
  expires_at: string
}

export type MockPaymentIntent = {
  payment_intent_id: string
  client_secret: string
  amount_yen: number
  currency: string
  menu_id: string
  start_at: string
  shop_slug: string
}

export type MockStaffInvitation = {
  invite_id: string
  email: string
  signup_url: string
  expires_at: string
}

export type MockState = {
  session: {
    admin: MockAdminSession
    customer: MockCustomerSession
  }
  salons: Record<string, MockSalon>
  menus: MockMenu[]
  trainers: MockTrainer[]
  shifts: MockShift[]
  reservations: MockReservation[]
  admin_users: MockAdminUser[]
  customer_users: MockCustomerUser[]
  business_hours: MockBusinessHour[]
  holidays: string[]
  booking_rules: MockBookingRules
  stripe: { connected: boolean; account_id: string | null; status: string | null }
  paypay: {
    configured: boolean
    mode: "sandbox" | "production" | null
    merchant_id_masked: string | null
  }
  signup_tokens: MockSignupToken[]
  staff_invitations: MockStaffInvitation[]
  otp_challenges: MockOtpChallenge[]
  lookup_tokens: MockLookupToken[]
  payment_intents: MockPaymentIntent[]
}

function todayIsoDate(offset = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function isoAt(dateKey: string, hhmm: string, tz = "+09:00"): string {
  return `${dateKey}T${hhmm}:00${tz}`
}

function seedInitial(): MockState {
  const salon: MockSalon = {
    salon_id: "salon_001",
    slug: DEFAULT_SHOP_SLUG,
    salon_name: "サンプルサロン",
    description: "都心に佇む、静けさを大切にしたパーソナルサロンです。",
    address: "東京都渋谷区代官山町1-2-3",
    phone: "03-1234-5678",
    logo_url: null,
    cover_image_url: null,
    instagram_url: "https://instagram.com/example",
    line_url: null,
    website_url: null,
    theme_color: "#6366f1",
    booking_page_message: "初回のお客様歓迎です。ゆったりとお過ごしください。",
    cancellation_policy_text:
      "予約時間の24時間前を過ぎるとキャンセル料が発生する場合があります。",
    timezone: "Asia/Tokyo",
  }

  const menus: MockMenu[] = [
    {
      menu_id: "menu_001",
      name: "パーソナル 60分",
      duration_minutes: 60,
      price: 8800,
      description: "初回のお客様向け 60 分のコース。",
      image_url:
        "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1400&q=80",
      is_public: true,
      is_archived: false,
    },
    {
      menu_id: "menu_002",
      name: "パーソナル 90分",
      duration_minutes: 90,
      price: 12800,
      description: "じっくり整えたい方向けの 90 分コース。",
      image_url: null,
      is_public: true,
      is_archived: false,
    },
    {
      menu_id: "menu_003",
      name: "初回体験",
      duration_minutes: 45,
      price: 4400,
      description: "はじめての方向けのおためしコース。",
      image_url: null,
      is_public: true,
      is_archived: false,
    },
    {
      menu_id: "menu_004",
      name: "コンディショニング",
      duration_minutes: 60,
      price: 7700,
      description: null,
      image_url: null,
      is_public: false,
      is_archived: false,
    },
  ]

  const trainers: MockTrainer[] = [
    {
      trainer_id: "st_001",
      name: "山本 綾",
      color: "#3b82f6",
      description: "コンディショニングが得意です。",
      image_url: null,
      display_order: 0,
      admin_id: null,
      menu_ids: ["menu_001", "menu_002", "menu_003"],
      is_active: true,
    },
    {
      trainer_id: "st_002",
      name: "佐々木 陽",
      color: "#22c55e",
      description: "食事アドバイスも対応します。",
      image_url: null,
      display_order: 1,
      admin_id: null,
      menu_ids: ["menu_001", "menu_002"],
      is_active: true,
    },
    {
      trainer_id: "st_003",
      name: "中村 蓮",
      color: "#f59e0b",
      description: null,
      image_url: null,
      display_order: 2,
      admin_id: null,
      menu_ids: ["menu_001", "menu_003"],
      is_active: true,
    },
  ]

  const shifts: MockShift[] = []
  // 直近14日間、平日は09:00-18:00 / 土日は10:00-16:00
  for (let offset = 0; offset < 21; offset++) {
    const dateKey = todayIsoDate(offset)
    const dow = new Date(dateKey).getDay()
    const isWeekend = dow === 0 || dow === 6
    const start = isWeekend ? "10:00" : "09:00"
    const end = isWeekend ? "16:00" : "18:00"
    for (const t of trainers) {
      shifts.push({
        shift_id: `sh_${t.trainer_id}_${dateKey}`,
        trainer_id: t.trainer_id,
        date: dateKey,
        start_time: start,
        end_time: end,
      })
    }
  }

  const business_hours: MockBusinessHour[] = [
    { day_of_week: 0, start_time: "09:00", end_time: "18:00", is_closed: false },
    { day_of_week: 1, start_time: "09:00", end_time: "18:00", is_closed: false },
    { day_of_week: 2, start_time: "09:00", end_time: "18:00", is_closed: false },
    { day_of_week: 3, start_time: "09:00", end_time: "18:00", is_closed: false },
    { day_of_week: 4, start_time: "09:00", end_time: "18:00", is_closed: false },
    { day_of_week: 5, start_time: "10:00", end_time: "16:00", is_closed: false },
    { day_of_week: 6, start_time: "10:00", end_time: "16:00", is_closed: true },
  ]

  const reservations: MockReservation[] = buildInitialReservations(menus, trainers)

  const admin_users: MockAdminUser[] = [
    {
      admin_id: "ad_owner_001",
      name: "オーナー太郎",
      email: "admin@example.com",
      password: "admin123",
      role: "owner",
      is_active: true,
      avatar_url: null,
      salon_id: salon.salon_id,
    },
    {
      admin_id: "ad_staff_001",
      name: "スタッフ花子",
      email: "staff@example.com",
      password: "staff123",
      role: "staff",
      is_active: true,
      avatar_url: null,
      salon_id: salon.salon_id,
    },
  ]

  const customer_users: MockCustomerUser[] = [
    {
      user_id: "cu_001",
      email: "customer@example.com",
      password: "customer123",
      name: "サンプル顧客",
      phone: null,
      shop_slug: DEFAULT_SHOP_SLUG,
    },
  ]

  return {
    session: { admin: null, customer: null },
    salons: { [salon.slug]: salon },
    menus,
    trainers,
    shifts,
    reservations,
    admin_users,
    customer_users,
    business_hours,
    holidays: [],
    booking_rules: {
      allow_same_day: false,
      booking_deadline_minutes: 120,
      buffer_minutes: 0,
      slot_increment_minutes: 30,
      cancellation_deadline_hours: 24,
      max_advance_days: 60,
    },
    stripe: { connected: false, account_id: null, status: null },
    paypay: { configured: false, mode: null, merchant_id_masked: null },
    signup_tokens: [],
    staff_invitations: [],
    otp_challenges: [],
    lookup_tokens: [],
    payment_intents: [],
  }
}

function buildInitialReservations(
  menus: MockMenu[],
  trainers: MockTrainer[],
): MockReservation[] {
  const menuById = new Map(menus.map((m) => [m.menu_id, m]))
  const list: Array<{
    id: string
    day: number
    time: string
    trainer: string
    name: string
    email: string
    menu: string
    memo?: string
  }> = [
    { id: "res_001", day: 0, time: "09:00", trainer: "st_001", name: "山田 太郎", email: "yamada@example.com", menu: "menu_001", memo: "初回利用" },
    { id: "res_002", day: 0, time: "11:00", trainer: "st_002", name: "佐藤 花子", email: "sato@example.com", menu: "menu_001" },
    { id: "res_003", day: 0, time: "14:00", trainer: "st_001", name: "鈴木 一郎", email: "suzuki@example.com", menu: "menu_002", memo: "90分希望" },
    { id: "res_004", day: 1, time: "10:00", trainer: "st_003", name: "田中 美咲", email: "tanaka@example.com", menu: "menu_001" },
    { id: "res_005", day: 1, time: "13:00", trainer: "st_002", name: "高橋 健太", email: "takahashi@example.com", menu: "menu_003" },
    { id: "res_006", day: 1, time: "15:30", trainer: "st_001", name: "伊藤 恵子", email: "ito@example.com", menu: "menu_001" },
    { id: "res_007", day: 2, time: "09:00", trainer: "st_003", name: "渡辺 大輔", email: "watanabe@example.com", menu: "menu_001" },
    { id: "res_008", day: 2, time: "11:00", trainer: "st_002", name: "中村 優子", email: "nakamura@example.com", menu: "menu_002" },
    { id: "res_009", day: 2, time: "14:00", trainer: "st_003", name: "小林 翔太", email: "kobayashi@example.com", menu: "menu_001" },
  ]
  return list.map((row) => {
    const dateKey = todayIsoDate(row.day)
    const menu = menuById.get(row.menu)
    const duration = menu?.duration_minutes ?? 60
    const startD = new Date(`${dateKey}T${row.time}:00+09:00`)
    const endD = new Date(startD.getTime() + duration * 60 * 1000)
    const endHhmm = `${String(endD.getHours()).padStart(2, "0")}:${String(endD.getMinutes()).padStart(2, "0")}`
    const trainer = trainers.find((t) => t.trainer_id === row.trainer)
    return {
      reservation_id: row.id,
      menu_id: menu?.menu_id ?? null,
      menu_name: menu?.name ?? null,
      start_at: isoAt(dateKey, row.time),
      service_end_at: isoAt(dateKey, endHhmm),
      customer_name: row.name,
      customer_email: row.email,
      customer_phone: null,
      notes: row.memo ?? null,
      status: "BOOKED",
      customer_id: null,
      trainer_id: trainer?.trainer_id ?? null,
      trainer_name: trainer?.name ?? null,
      booking_type: "OMAKASE",
      source: "mock",
      payment_status: "pending",
      payment_method: null,
      payment_id: null,
      payment_provider: null,
      payment_amount_yen: menu?.price ?? null,
      payment_currency: "JPY",
      payment_record_status: null,
      payment_refund_amount: null,
      payment_paid_at: null,
      created_at: new Date().toISOString(),
      confirmation_token: `tok_${row.id}`,
    }
  })
}

let stateSingleton: MockState | null = null

function reviveState(raw: unknown): MockState | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Partial<MockState>
  if (!o.salons || !o.menus || !o.trainers) return null
  return raw as MockState
}

function loadFromStorage(): MockState | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return reviveState(JSON.parse(raw))
  } catch {
    return null
  }
}

function saveToStorage(state: MockState): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

export function getMockState(): MockState {
  if (stateSingleton) return stateSingleton
  const loaded = loadFromStorage()
  if (loaded) {
    stateSingleton = loaded
  } else {
    stateSingleton = seedInitial()
    saveToStorage(stateSingleton)
  }
  return stateSingleton
}

export function persistMockState(): void {
  if (!stateSingleton) return
  saveToStorage(stateSingleton)
}

export function resetMockState(): void {
  stateSingleton = seedInitial()
  saveToStorage(stateSingleton)
}

export function getDefaultShopSlug(): string {
  return DEFAULT_SHOP_SLUG
}

/**
 * サーバー側で slug を未知にした際、既存のサンプルサロンにフォールバックする。
 */
export function ensureSalon(slug: string): MockSalon {
  const state = getMockState()
  const found = state.salons[slug]
  if (found) return found
  const fallback = state.salons[DEFAULT_SHOP_SLUG]
  state.salons[slug] = { ...fallback, slug }
  persistMockState()
  return state.salons[slug]
}

let idCounter = 1
export function nextId(prefix: string): string {
  idCounter += 1
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}`
}
