/**
 * フロントエンド専用モック: `window.fetch` を差し替え、
 * バックエンド API 呼び出しをすべて in-memory + localStorage の
 * モックデータで解決する。
 *
 * 本モックはデータ整合性を最小限のみ担保し、画面遷移と操作フローを
 * 一通り体験できることを主目的にする。
 */
import {
  ensureSalon,
  getDefaultShopSlug,
  getMockState,
  nextId,
  persistMockState,
  type MockAdminUser,
  type MockMenu,
  type MockReservation,
  type MockTrainer,
} from "@/mocks/state"

type JsonBody = Record<string, unknown> | unknown[] | number | string | boolean | null

type RouteMatch = {
  method: string
  match: (url: URL) => Record<string, string> | null
  handle: (ctx: {
    url: URL
    params: Record<string, string>
    body: unknown
    request: Request
  }) => Promise<Response> | Response
}

function json(body: JsonBody, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  })
}

function noContent(): Response {
  return new Response(null, { status: 204 })
}

function unauthorized(message = "Not authenticated"): Response {
  return json({ detail: message }, { status: 401 })
}

function notFound(message = "Not found"): Response {
  return json({ detail: message }, { status: 404 })
}

function badRequest(message: string): Response {
  return json({ detail: message }, { status: 400 })
}

function conflict(message: string): Response {
  return json({ detail: message }, { status: 409 })
}

async function readJsonBody(request: Request): Promise<unknown> {
  const ct = request.headers.get("content-type") || ""
  if (!ct.toLowerCase().includes("application/json")) {
    try {
      const text = await request.clone().text()
      if (!text.trim()) return null
      return JSON.parse(text)
    } catch {
      return null
    }
  }
  try {
    return await request.clone().json()
  } catch {
    return null
  }
}

function bodyRecord(body: unknown): Record<string, unknown> {
  return body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {}
}

/** 分数を "HH:mm" に */
function minutesToHHmm(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`
}

function isoAddMinutes(iso: string, minutes: number): string {
  const d = new Date(iso)
  const next = new Date(d.getTime() + minutes * 60 * 1000)
  return next.toISOString()
}

function dateKeyFromIso(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function findMenuById(id: string | null | undefined): MockMenu | undefined {
  if (!id) return undefined
  return getMockState().menus.find((m) => m.menu_id === id)
}

function findTrainerById(id: string | null | undefined): MockTrainer | undefined {
  if (!id) return undefined
  return getMockState().trainers.find((t) => t.trainer_id === id)
}

function requireAdmin(): MockAdminUser | null {
  const s = getMockState()
  if (!s.session.admin) return null
  return s.admin_users.find((u) => u.admin_id === s.session.admin?.admin_id) ?? null
}

function ensureAdminSession(): Response | null {
  const admin = requireAdmin()
  if (!admin) return unauthorized()
  return null
}

function menuOutJson(menu: MockMenu): Record<string, unknown> {
  return {
    menu_id: menu.menu_id,
    name: menu.name,
    duration_minutes: menu.duration_minutes,
    price: menu.price,
    description: menu.description,
    image_url: menu.image_url,
    is_public: menu.is_public,
    is_archived: menu.is_archived,
  }
}

function trainerOutJson(t: MockTrainer): Record<string, unknown> {
  return {
    trainer_id: t.trainer_id,
    name: t.name,
    color: t.color,
    description: t.description,
    image_url: t.image_url,
    display_order: t.display_order,
    admin_id: t.admin_id,
    menu_ids: t.menu_ids,
    is_active: t.is_active,
  }
}

function reservationOutJson(r: MockReservation): Record<string, unknown> {
  return {
    reservation_id: r.reservation_id,
    menu_id: r.menu_id,
    menu_name: r.menu_name,
    start_at: r.start_at,
    service_end_at: r.service_end_at,
    customer_name: r.customer_name,
    customer_email: r.customer_email,
    customer_phone: r.customer_phone,
    notes: r.notes,
    status: r.status,
    customer_id: r.customer_id,
    trainer_id: r.trainer_id,
    trainer_name: r.trainer_name,
    booking_type: r.booking_type,
    source: r.source,
    payment_status: r.payment_status,
    payment_method: r.payment_method,
    payment_id: r.payment_id,
    payment_provider: r.payment_provider,
    payment_amount_yen: r.payment_amount_yen,
    payment_currency: r.payment_currency,
    payment_record_status: r.payment_record_status,
    payment_refund_amount: r.payment_refund_amount,
    payment_paid_at: r.payment_paid_at,
    created_at: r.created_at,
    confirmation_token: r.confirmation_token,
  }
}

function reservationDetailJson(r: MockReservation): Record<string, unknown> {
  return {
    ...reservationOutJson(r),
    can_cancel: r.status === "BOOKED",
  }
}

/* ---------------------------------------------------------------------------
 * 汎用ルーターユーティリティ
 * -------------------------------------------------------------------------*/
function exact(path: string) {
  return (url: URL): Record<string, string> | null =>
    url.pathname === path ? {} : null
}

function pattern(template: string) {
  const parts = template.split("/").filter(Boolean)
  return (url: URL): Record<string, string> | null => {
    const seg = url.pathname.split("/").filter(Boolean)
    if (seg.length !== parts.length) return null
    const params: Record<string, string> = {}
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]
      if (p.startsWith(":")) {
        params[p.slice(1)] = decodeURIComponent(seg[i])
      } else if (p !== seg[i]) {
        return null
      }
    }
    return params
  }
}

const routes: RouteMatch[] = []

function route(
  method: string,
  matcher: (url: URL) => Record<string, string> | null,
  handle: RouteMatch["handle"],
) {
  routes.push({ method: method.toUpperCase(), match: matcher, handle })
}

/* ---------------------------------------------------------------------------
 * ルート定義
 * -------------------------------------------------------------------------*/

// --- Admin 認証 ---
route("POST", exact("/api/admin/login"), async ({ body }) => {
  const b = bodyRecord(body)
  const email = String(b.email ?? "").trim().toLowerCase()
  const password = String(b.password ?? "")
  const state = getMockState()
  const user = state.admin_users.find(
    (u) => u.email.toLowerCase() === email && u.password === password && u.is_active,
  )
  if (!user) return unauthorized("メールアドレスまたはパスワードが違います")
  state.session.admin = {
    admin_id: user.admin_id,
    email: user.email,
    name: user.name,
    role: user.role,
    salon_id: user.salon_id,
    avatar_url: user.avatar_url,
  }
  persistMockState()
  return json({ ok: true, admin_id: user.admin_id })
})

route("POST", exact("/api/admin/logout"), () => {
  const state = getMockState()
  state.session.admin = null
  persistMockState()
  return noContent()
})

route("GET", exact("/api/admin/me"), () => {
  const state = getMockState()
  const s = state.session.admin
  if (!s) return unauthorized()
  const salon = Object.values(state.salons)[0]
  return json({
    admin_id: s.admin_id,
    name: s.name,
    email: s.email,
    role: s.role,
    avatar_url: s.avatar_url,
    salon_name: salon?.salon_name ?? null,
    salon: salon
      ? { salon_id: salon.salon_id, name: salon.salon_name, slug: salon.slug }
      : null,
  })
})

route("POST", exact("/api/admin/signup"), async ({ body }) => {
  const b = bodyRecord(body)
  const email = String(b.email ?? "").trim().toLowerCase()
  const password = String(b.password ?? "")
  const name = String(b.name ?? "").trim() || "オーナー"
  const salonName = String(b.salon_name ?? "").trim()
  const salonSlug = String(b.salon_slug ?? "").trim().toLowerCase()
  const inviteToken = String(b.invite_token ?? "").trim()

  if (!email || !password) {
    return badRequest("入力内容を確認してください")
  }
  const state = getMockState()
  if (state.admin_users.some((u) => u.email.toLowerCase() === email)) {
    return conflict("既に登録されているメールアドレスです")
  }
  // メール可用性チェック用の probe（salon_name も invite_token も無いリクエスト）は登録せず、
  // salon 必須のバリデーションエラーを返す（caller は「available」と判定する）。
  if (!salonName && !inviteToken) {
    return badRequest("salon_name is required")
  }
  if (salonSlug && Object.keys(state.salons).some((s) => s === salonSlug && s !== getDefaultShopSlug())) {
    return conflict("既に使用されているサロンのスラッグ（ページ URL）です")
  }

  const adminId = nextId("ad")
  const salonId = nextId("salon")
  const finalSlug = salonSlug || `salon-${adminId.slice(-6).toLowerCase()}`
  if (salonName) {
    state.salons[finalSlug] = {
      salon_id: salonId,
      slug: finalSlug,
      salon_name: salonName,
      description: null,
      address: null,
      phone: null,
      logo_url: null,
      cover_image_url: null,
      instagram_url: null,
      line_url: null,
      website_url: null,
      theme_color: "#6366f1",
      booking_page_message: null,
      cancellation_policy_text: null,
      timezone: "Asia/Tokyo",
    }
  }
  const user: MockAdminUser = {
    admin_id: adminId,
    name,
    email,
    password,
    role: "owner",
    is_active: true,
    avatar_url: null,
    salon_id: salonName ? salonId : state.admin_users[0]?.salon_id ?? "salon_001",
  }
  state.admin_users.push(user)
  state.session.admin = {
    admin_id: user.admin_id,
    email: user.email,
    name: user.name,
    role: user.role,
    salon_id: user.salon_id,
    avatar_url: user.avatar_url,
  }
  persistMockState()
  return json({ admin_id: adminId, salon_slug: finalSlug }, { status: 201 })
})

route("POST", exact("/api/admin/signup-verifications"), async ({ body }) => {
  const b = bodyRecord(body)
  const email = String(b.email ?? "").trim().toLowerCase()
  if (!email) return badRequest("email is required")
  const state = getMockState()
  const token = nextId("sv")
  state.signup_tokens.push({
    token,
    email,
    used: false,
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  })
  persistMockState()
  return json({
    email,
    token,
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  })
})

route("POST", exact("/api/admin/signup-verifications/verify"), async ({ body }) => {
  const b = bodyRecord(body)
  const token = String(b.token ?? "").trim()
  const state = getMockState()
  const entry = state.signup_tokens.find((t) => t.token === token) ??
    /* Any token works in mock */ state.signup_tokens[state.signup_tokens.length - 1]
  const email = entry?.email ?? "owner@example.com"
  if (entry) entry.used = true
  persistMockState()
  return json({ email })
})

// --- Admin プロフィール ---
route("GET", exact("/api/admin/profile"), () => {
  const err = ensureAdminSession()
  if (err) return err
  const state = getMockState()
  const salon = Object.values(state.salons)[0]
  if (!salon) return notFound()
  return json({
    salon_id: salon.salon_id,
    salon_name: salon.salon_name,
    slug: salon.slug,
    description: salon.description,
    logo_url: salon.logo_url,
    cover_image_url: salon.cover_image_url,
    phone: salon.phone,
    address: salon.address,
    instagram_url: salon.instagram_url,
    line_url: salon.line_url,
    website_url: salon.website_url,
    theme_color: salon.theme_color,
    booking_page_message: salon.booking_page_message,
    cancellation_policy_text: salon.cancellation_policy_text,
    timezone: salon.timezone,
    salon: { salon_id: salon.salon_id, name: salon.salon_name },
  })
})

route("PUT", exact("/api/admin/profile"), async ({ body }) => {
  const err = ensureAdminSession()
  if (err) return err
  const state = getMockState()
  const b = bodyRecord(body)
  const salon = Object.values(state.salons)[0]
  if (!salon) return notFound()
  if (typeof b.salon_name === "string") salon.salon_name = b.salon_name.trim()
  if (typeof b.slug === "string") {
    const newSlug = b.slug.trim().toLowerCase()
    if (newSlug && newSlug !== salon.slug) {
      delete state.salons[salon.slug]
      salon.slug = newSlug
      state.salons[newSlug] = salon
    }
  }
  if (b.description !== undefined) salon.description = b.description as string | null
  if (b.logo_url !== undefined) salon.logo_url = b.logo_url as string | null
  if (b.cover_image_url !== undefined) salon.cover_image_url = b.cover_image_url as string | null
  if (b.phone !== undefined) salon.phone = b.phone as string | null
  if (b.address !== undefined) salon.address = b.address as string | null
  if (b.instagram_url !== undefined) salon.instagram_url = b.instagram_url as string | null
  if (b.line_url !== undefined) salon.line_url = b.line_url as string | null
  if (b.website_url !== undefined) salon.website_url = b.website_url as string | null
  if (typeof b.theme_color === "string") salon.theme_color = b.theme_color
  if (b.booking_page_message !== undefined) salon.booking_page_message = b.booking_page_message as string | null
  if (b.cancellation_policy_text !== undefined) salon.cancellation_policy_text = b.cancellation_policy_text as string | null
  if (typeof b.timezone === "string") salon.timezone = b.timezone
  persistMockState()
  return json({
    salon_id: salon.salon_id,
    salon_name: salon.salon_name,
    slug: salon.slug,
    description: salon.description,
    logo_url: salon.logo_url,
    cover_image_url: salon.cover_image_url,
    phone: salon.phone,
    address: salon.address,
    instagram_url: salon.instagram_url,
    line_url: salon.line_url,
    website_url: salon.website_url,
    theme_color: salon.theme_color,
    booking_page_message: salon.booking_page_message,
    cancellation_policy_text: salon.cancellation_policy_text,
    timezone: salon.timezone,
    salon: { salon_id: salon.salon_id, name: salon.salon_name },
  })
})

// --- Admin メニュー ---
route("GET", exact("/api/admin/menus"), () => {
  const err = ensureAdminSession()
  if (err) return err
  return json(getMockState().menus.map(menuOutJson))
})

route("POST", exact("/api/admin/menus"), async ({ body }) => {
  const err = ensureAdminSession()
  if (err) return err
  const b = bodyRecord(body)
  const menu: MockMenu = {
    menu_id: nextId("menu"),
    name: String(b.name ?? "新規メニュー").trim(),
    duration_minutes: Number(b.duration_minutes) || 60,
    price: Number(b.price) || 0,
    description: (b.description as string) ?? null,
    image_url: (b.image_url as string) ?? null,
    is_public: b.is_public === undefined ? true : Boolean(b.is_public),
    is_archived: Boolean(b.is_archived),
  }
  getMockState().menus.push(menu)
  persistMockState()
  return json(menuOutJson(menu), { status: 201 })
})

route("PUT", pattern("/api/admin/menus/:menuId"), async ({ params, body }) => {
  const err = ensureAdminSession()
  if (err) return err
  const menu = getMockState().menus.find((m) => m.menu_id === params.menuId)
  if (!menu) return notFound()
  const b = bodyRecord(body)
  if (typeof b.name === "string") menu.name = b.name.trim()
  if (typeof b.duration_minutes === "number") menu.duration_minutes = b.duration_minutes
  if (typeof b.price === "number") menu.price = b.price
  if (b.description !== undefined) menu.description = b.description as string | null
  if (b.image_url !== undefined) menu.image_url = b.image_url as string | null
  if (typeof b.is_public === "boolean") menu.is_public = b.is_public
  if (typeof b.is_archived === "boolean") menu.is_archived = b.is_archived
  persistMockState()
  return json(menuOutJson(menu))
})

route("DELETE", pattern("/api/admin/menus/:menuId"), ({ params }) => {
  const err = ensureAdminSession()
  if (err) return err
  const state = getMockState()
  state.menus = state.menus.filter((m) => m.menu_id !== params.menuId)
  persistMockState()
  return noContent()
})

// --- Admin トレーナー ---
route("GET", exact("/api/admin/trainers"), () => {
  const err = ensureAdminSession()
  if (err) return err
  const list = getMockState()
    .trainers.filter((t) => t.is_active)
    .sort((a, b) => a.display_order - b.display_order)
    .map(trainerOutJson)
  return json(list)
})

route("GET", pattern("/api/admin/trainers/:trainerId"), ({ params }) => {
  const err = ensureAdminSession()
  if (err) return err
  const t = findTrainerById(params.trainerId)
  if (!t) return notFound()
  return json(trainerOutJson(t))
})

route("POST", exact("/api/admin/trainers"), async ({ body }) => {
  const err = ensureAdminSession()
  if (err) return err
  const state = getMockState()
  const b = bodyRecord(body)
  const trainer: MockTrainer = {
    trainer_id: nextId("st"),
    name: String(b.name ?? "新規スタッフ").trim(),
    color: String(b.color ?? "#64748b").trim(),
    description: (b.description as string) ?? null,
    image_url: (b.image_url as string) ?? null,
    display_order:
      typeof b.display_order === "number"
        ? b.display_order
        : state.trainers.length,
    admin_id: (b.admin_id as string) ?? null,
    menu_ids: Array.isArray(b.menu_ids) ? (b.menu_ids as string[]) : [],
    is_active: true,
  }
  state.trainers.push(trainer)
  persistMockState()
  return json(trainerOutJson(trainer), { status: 201 })
})

route("PUT", pattern("/api/admin/trainers/:trainerId"), async ({ params, body }) => {
  const err = ensureAdminSession()
  if (err) return err
  const t = findTrainerById(params.trainerId)
  if (!t) return notFound()
  const b = bodyRecord(body)
  if (typeof b.name === "string") t.name = b.name.trim()
  if (typeof b.color === "string") t.color = b.color.trim()
  if (b.description !== undefined) t.description = b.description as string | null
  if (b.image_url !== undefined) t.image_url = b.image_url as string | null
  if (typeof b.display_order === "number") t.display_order = b.display_order
  if (Array.isArray(b.menu_ids)) t.menu_ids = b.menu_ids as string[]
  if (b.is_active === false) t.is_active = false
  persistMockState()
  return json(trainerOutJson(t))
})

route("POST", exact("/api/admin/trainers/profile-image/upload"), async ({ request }) => {
  const err = ensureAdminSession()
  if (err) return err
  // FormData を data URL に変換して返す。
  try {
    const form = await request.clone().formData()
    const file = form.get("file")
    if (file instanceof File) {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result ?? ""))
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      })
      return json({ url: dataUrl })
    }
  } catch {
    /* ignore */
  }
  return json({
    url:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80",
  })
})

// --- Admin トレーナーシフト ---
route(
  "GET",
  pattern("/api/admin/trainers/:trainerId/shifts"),
  ({ params, url }) => {
    const err = ensureAdminSession()
    if (err) return err
    const from = url.searchParams.get("date_from") ?? ""
    const to = url.searchParams.get("date_to") ?? ""
    const rows = getMockState().shifts.filter(
      (s) =>
        s.trainer_id === params.trainerId &&
        (!from || s.date >= from) &&
        (!to || s.date <= to),
    )
    return json(rows)
  },
)

route(
  "POST",
  pattern("/api/admin/trainers/:trainerId/shifts"),
  async ({ params, body }) => {
    const err = ensureAdminSession()
    if (err) return err
    const b = bodyRecord(body)
    const row = {
      shift_id: nextId("sh"),
      trainer_id: params.trainerId,
      date: String(b.date ?? "").slice(0, 10),
      start_time: String(b.start_time ?? "09:00").slice(0, 5),
      end_time: String(b.end_time ?? "18:00").slice(0, 5),
    }
    getMockState().shifts.push(row)
    persistMockState()
    return json(row, { status: 201 })
  },
)

route(
  "PUT",
  pattern("/api/admin/trainers/:trainerId/shifts/:shiftId"),
  async ({ params, body }) => {
    const err = ensureAdminSession()
    if (err) return err
    const row = getMockState().shifts.find(
      (s) => s.trainer_id === params.trainerId && s.shift_id === params.shiftId,
    )
    if (!row) return notFound()
    const b = bodyRecord(body)
    if (typeof b.date === "string") row.date = b.date.slice(0, 10)
    if (typeof b.start_time === "string") row.start_time = b.start_time.slice(0, 5)
    if (typeof b.end_time === "string") row.end_time = b.end_time.slice(0, 5)
    persistMockState()
    return noContent()
  },
)

route(
  "DELETE",
  pattern("/api/admin/trainers/:trainerId/shifts/:shiftId"),
  ({ params }) => {
    const err = ensureAdminSession()
    if (err) return err
    const state = getMockState()
    state.shifts = state.shifts.filter(
      (s) => !(s.trainer_id === params.trainerId && s.shift_id === params.shiftId),
    )
    persistMockState()
    return noContent()
  },
)

route(
  "POST",
  pattern("/api/admin/trainers/:trainerId/shifts/bulk"),
  async ({ params, body }) => {
    const err = ensureAdminSession()
    if (err) return err
    const b = bodyRecord(body)
    const raw = Array.isArray(b.shifts) ? (b.shifts as Array<Record<string, unknown>>) : []
    const state = getMockState()
    const created = raw.map((r) => {
      const row = {
        shift_id: nextId("sh"),
        trainer_id: params.trainerId,
        date: String(r.date ?? "").slice(0, 10),
        start_time: String(r.start_time ?? "09:00").slice(0, 5),
        end_time: String(r.end_time ?? "18:00").slice(0, 5),
      }
      state.shifts.push(row)
      return row
    })
    persistMockState()
    return json(created, { status: 201 })
  },
)

// --- Admin 管理者ユーザー ---
route("GET", exact("/api/admin/admin-users"), () => {
  const err = ensureAdminSession()
  if (err) return err
  return json(
    getMockState().admin_users.map((u) => ({
      admin_id: u.admin_id,
      name: u.name,
      email: u.email,
      role: u.role,
      is_active: u.is_active,
    })),
  )
})

route("POST", exact("/api/admin/admin-users"), async ({ body }) => {
  const err = ensureAdminSession()
  if (err) return err
  const b = bodyRecord(body)
  const email = String(b.email ?? "").trim().toLowerCase()
  const state = getMockState()
  if (state.admin_users.some((u) => u.email.toLowerCase() === email)) {
    return conflict("このメールアドレスは既に登録されています")
  }
  const user: MockAdminUser = {
    admin_id: nextId("ad"),
    email,
    password: String(b.password ?? "password123"),
    name: String(b.name ?? "").trim() || email,
    role: (b.role as "owner" | "staff") ?? "staff",
    is_active: b.is_active === false ? false : true,
    avatar_url: (b.avatar_url as string) ?? null,
    salon_id: state.admin_users[0]?.salon_id ?? "salon_001",
  }
  state.admin_users.push(user)
  persistMockState()
  return json(
    {
      admin_id: user.admin_id,
      email: user.email,
      name: user.name,
      role: user.role,
      is_active: user.is_active,
    },
    { status: 201 },
  )
})

route("POST", exact("/api/admin/staff-invitations"), async ({ body }) => {
  const err = ensureAdminSession()
  if (err) return err
  const b = bodyRecord(body)
  const email = String(b.email ?? "").trim().toLowerCase()
  if (!email) return badRequest("email is required")
  const invite = {
    invite_id: nextId("inv"),
    email,
    signup_url: `${window.location.origin}/backoffice/signup?invite=${nextId("token")}`,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  }
  getMockState().staff_invitations.push(invite)
  persistMockState()
  return json(invite, { status: 201 })
})

// --- Admin 設定 ---
route("GET", exact("/api/admin/settings"), () => {
  const err = ensureAdminSession()
  if (err) return err
  const state = getMockState()
  return json({
    business_hours: state.business_hours,
    holidays: state.holidays,
    booking_rules: state.booking_rules,
  })
})

route("GET", exact("/api/admin/settings/business-hours"), () => {
  const err = ensureAdminSession()
  if (err) return err
  return json(getMockState().business_hours)
})

route("PUT", exact("/api/admin/settings/business-hours"), async ({ body }) => {
  const err = ensureAdminSession()
  if (err) return err
  const b = bodyRecord(body)
  if (Array.isArray(b.hours)) {
    const state = getMockState()
    state.business_hours = (b.hours as Array<Record<string, unknown>>)
      .map((h) => ({
        day_of_week: Number(h.day_of_week ?? 0),
        start_time: String(h.start_time ?? "09:00").slice(0, 5),
        end_time: String(h.end_time ?? "18:00").slice(0, 5),
        is_closed: Boolean(h.is_closed),
      }))
      .filter((h) => Number.isFinite(h.day_of_week))
    persistMockState()
  }
  return noContent()
})

route("GET", exact("/api/admin/settings/holidays"), () => {
  const err = ensureAdminSession()
  if (err) return err
  return json(getMockState().holidays)
})

route("POST", exact("/api/admin/settings/holidays"), async ({ body }) => {
  const err = ensureAdminSession()
  if (err) return err
  const b = bodyRecord(body)
  const date = String(b.date ?? "").slice(0, 10)
  const description = (b.description as string) ?? null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return badRequest("invalid date")
  const state = getMockState()
  if (!state.holidays.includes(date)) state.holidays.push(date)
  persistMockState()
  return json({ id: nextId("hol"), date, description }, { status: 201 })
})

route("PUT", exact("/api/admin/settings/booking-rules"), async ({ body }) => {
  const err = ensureAdminSession()
  if (err) return err
  const b = bodyRecord(body)
  const state = getMockState()
  state.booking_rules = {
    ...state.booking_rules,
    ...Object.fromEntries(
      Object.entries(b).filter(([, v]) => v !== undefined && v !== null),
    ),
  } as typeof state.booking_rules
  persistMockState()
  return noContent()
})

route("POST", exact("/api/admin/settings/booking-rules"), async ({ body }) => {
  const err = ensureAdminSession()
  if (err) return err
  const b = bodyRecord(body)
  const state = getMockState()
  state.booking_rules = {
    ...state.booking_rules,
    ...Object.fromEntries(
      Object.entries(b).filter(([, v]) => v !== undefined && v !== null),
    ),
  } as typeof state.booking_rules
  persistMockState()
  return json({}, { status: 201 })
})

// --- Admin 予約 ---
function paginate<T>(items: T[], page: number, perPage: number) {
  const start = (page - 1) * perPage
  return {
    items: items.slice(start, start + perPage),
    total: items.length,
    page,
    per_page: perPage,
  }
}

route("GET", exact("/api/admin/reservations"), ({ url }) => {
  const err = ensureAdminSession()
  if (err) return err
  const state = getMockState()
  const view = url.searchParams.get("view")
  const dateParam = url.searchParams.get("date")
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"))
  const perPage = Math.max(1, Number(url.searchParams.get("per_page") ?? "100"))
  let items = [...state.reservations]
  if (dateParam) {
    if (view === "week") {
      const anchor = new Date(`${dateParam}T00:00:00+09:00`)
      const dow = anchor.getDay() // Sun=0
      const monday = new Date(anchor)
      monday.setDate(anchor.getDate() - ((dow + 6) % 7))
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      const startKey = dateKeyFromIso(monday.toISOString())
      const endKey = dateKeyFromIso(sunday.toISOString())
      items = items.filter((r) => {
        const k = dateKeyFromIso(r.start_at)
        return k >= startKey && k <= endKey
      })
    } else {
      items = items.filter((r) => dateKeyFromIso(r.start_at) === dateParam)
    }
  }
  return json(paginate(items.map(reservationOutJson), page, perPage))
})

route("POST", exact("/api/admin/reservations"), async ({ body }) => {
  const err = ensureAdminSession()
  if (err) return err
  const b = bodyRecord(body)
  const menu = findMenuById(String(b.menu_id ?? ""))
  const startAt = String(b.start_at ?? "")
  const endAt = String(b.end_at ?? isoAddMinutes(startAt, menu?.duration_minutes ?? 60))
  const trainerId = (b.trainer_id as string) ?? null
  const trainer = findTrainerById(trainerId)
  const reservation: MockReservation = {
    reservation_id: nextId("res"),
    menu_id: menu?.menu_id ?? null,
    menu_name: menu?.name ?? null,
    start_at: startAt,
    service_end_at: endAt,
    customer_name: String(b.customer_name ?? "").trim() || "予約者",
    customer_email: String(b.customer_email ?? "").trim(),
    customer_phone: (b.customer_phone as string) ?? null,
    notes: (b.notes as string) ?? null,
    status: "BOOKED",
    customer_id: (b.customer_id as string) ?? null,
    trainer_id: trainer?.trainer_id ?? null,
    trainer_name: trainer?.name ?? null,
    booking_type: (b.booking_type as "SHIMEI" | "OMAKASE") ?? "OMAKASE",
    source: "admin",
    payment_status: "pending",
    payment_method: (b.payment_method as string) ?? null,
    payment_id: null,
    payment_provider: null,
    payment_amount_yen: menu?.price ?? null,
    payment_currency: "JPY",
    payment_record_status: null,
    payment_refund_amount: null,
    payment_paid_at: null,
    created_at: new Date().toISOString(),
    confirmation_token: nextId("tok"),
  }
  getMockState().reservations.push(reservation)
  persistMockState()
  return json(reservationOutJson(reservation), { status: 201 })
})

route("GET", pattern("/api/admin/reservations/:id"), ({ params }) => {
  const err = ensureAdminSession()
  if (err) return err
  const r = getMockState().reservations.find(
    (x) => x.reservation_id === params.id,
  )
  if (!r) return notFound()
  return json(reservationOutJson(r))
})

route("PUT", pattern("/api/admin/reservations/:id"), async ({ params, body }) => {
  const err = ensureAdminSession()
  if (err) return err
  const r = getMockState().reservations.find(
    (x) => x.reservation_id === params.id,
  )
  if (!r) return notFound()
  const b = bodyRecord(body)
  if (typeof b.trainer_id === "string") {
    const trainer = findTrainerById(b.trainer_id)
    r.trainer_id = trainer?.trainer_id ?? b.trainer_id
    r.trainer_name = trainer?.name ?? r.trainer_name
  }
  if (typeof b.start_at === "string") {
    const menu = findMenuById(r.menu_id)
    r.start_at = b.start_at
    r.service_end_at = isoAddMinutes(b.start_at, menu?.duration_minutes ?? 60)
  }
  if (b.notes !== undefined) r.notes = (b.notes as string) ?? null
  if (typeof b.customer_name === "string") r.customer_name = b.customer_name
  if (typeof b.customer_email === "string") r.customer_email = b.customer_email
  if (typeof b.customer_phone === "string" || b.customer_phone === null) {
    r.customer_phone = b.customer_phone as string | null
  }
  persistMockState()
  return json(reservationOutJson(r))
})

route(
  "PATCH",
  pattern("/api/admin/reservations/:id/status"),
  async ({ params, body }) => {
    const err = ensureAdminSession()
    if (err) return err
    const r = getMockState().reservations.find(
      (x) => x.reservation_id === params.id,
    )
    if (!r) return notFound()
    const b = bodyRecord(body)
    const next = String(b.status ?? "").toUpperCase()
    if (["BOOKED", "DONE", "NOSHOW", "CANCELED"].includes(next)) {
      r.status = next as MockReservation["status"]
    }
    if (b.refund_payment === true) {
      r.payment_refund_amount = r.payment_amount_yen ?? 0
      r.payment_status = "refunded"
      r.payment_record_status = "refunded"
    }
    persistMockState()
    return noContent()
  },
)

route("POST", pattern("/api/admin/payments/:id/refund"), ({ params }) => {
  const err = ensureAdminSession()
  if (err) return err
  const r = getMockState().reservations.find((x) => x.payment_id === params.id)
  if (r) {
    r.payment_refund_amount = r.payment_amount_yen ?? 0
    r.payment_status = "refunded"
    r.payment_record_status = "refunded"
    persistMockState()
  }
  return noContent()
})

// --- Admin Stripe / PayPay ---
route("GET", exact("/api/admin/stripe/status"), () => {
  const err = ensureAdminSession()
  if (err) return err
  return json(getMockState().stripe)
})

route("POST", exact("/api/admin/stripe/connect"), () => {
  const err = ensureAdminSession()
  if (err) return err
  const state = getMockState()
  state.stripe = {
    connected: true,
    account_id: `acct_mock_${nextId("acct")}`,
    status: "active",
  }
  persistMockState()
  return json({ onboarding_url: "#stripe-mock-onboarding" })
})

route("GET", exact("/api/admin/paypay/status"), () => {
  const err = ensureAdminSession()
  if (err) return err
  return json(getMockState().paypay)
})

route("PUT", exact("/api/admin/paypay/credentials"), async ({ body }) => {
  const err = ensureAdminSession()
  if (err) return err
  const b = bodyRecord(body)
  const state = getMockState()
  state.paypay = {
    configured: true,
    mode: (b.mode as "sandbox" | "production") ?? "sandbox",
    merchant_id_masked: String(b.merchant_id ?? "").slice(-4).padStart(8, "*"),
  }
  persistMockState()
  return json(state.paypay)
})

route("DELETE", exact("/api/admin/paypay/credentials"), () => {
  const err = ensureAdminSession()
  if (err) return err
  const state = getMockState()
  state.paypay = { configured: false, mode: null, merchant_id_masked: null }
  persistMockState()
  return json(state.paypay)
})

// --- 顧客 (customer) 認証 ---
route("GET", exact("/api/auth/me"), () => {
  const s = getMockState().session.customer
  if (!s) return unauthorized()
  return json({ user_id: s.user_id, name: s.name, email: s.email })
})

route(
  "POST",
  pattern("/api/s/:slug/auth/login"),
  async ({ params, body }) => {
    const state = getMockState()
    const b = bodyRecord(body)
    const email = String(b.email ?? "").trim().toLowerCase()
    const password = String(b.password ?? "")
    const user = state.customer_users.find(
      (u) => u.email.toLowerCase() === email && u.password === password,
    )
    if (!user) return unauthorized("Login failed. Please check your credentials.")
    ensureSalon(params.slug)
    state.session.customer = {
      user_id: user.user_id,
      email: user.email,
      name: user.name,
      shop_slug: params.slug,
    }
    persistMockState()
    return json({
      message: "ok",
      user_id: user.user_id,
      name: user.name,
    })
  },
)

route(
  "POST",
  pattern("/api/s/:slug/auth/register"),
  async ({ params, body }) => {
    const state = getMockState()
    const b = bodyRecord(body)
    const email = String(b.email ?? "").trim().toLowerCase()
    if (!email) return badRequest("email is required")
    if (state.customer_users.some((u) => u.email.toLowerCase() === email)) {
      return conflict("このメールアドレスは既に登録されています")
    }
    ensureSalon(params.slug)
    const user = {
      user_id: nextId("cu"),
      email,
      password: String(b.password ?? "password"),
      name: String(b.name ?? "").trim() || email,
      phone: (b.phone as string) ?? null,
      shop_slug: params.slug,
    }
    state.customer_users.push(user)
    state.session.customer = {
      user_id: user.user_id,
      email: user.email,
      name: user.name,
      shop_slug: params.slug,
    }
    persistMockState()
    return json(
      { message: "registered", user_id: user.user_id, name: user.name },
      { status: 201 },
    )
  },
)

route("GET", pattern("/api/s/:slug/auth/line/url"), ({ params }) => {
  return json({ url: `#mock-line-login?shop=${params.slug}` })
})

route(
  "POST",
  pattern("/api/s/:slug/auth/line/callback"),
  ({ params }) => {
    const state = getMockState()
    ensureSalon(params.slug)
    const user = state.customer_users[0] ?? {
      user_id: nextId("cu"),
      email: "line-user@example.com",
      password: "",
      name: "LINE ユーザー",
      phone: null,
      shop_slug: params.slug,
    }
    if (!state.customer_users.includes(user)) state.customer_users.push(user)
    state.session.customer = {
      user_id: user.user_id,
      email: user.email,
      name: user.name,
      shop_slug: params.slug,
    }
    persistMockState()
    return json({ message: "ok", user_id: user.user_id, name: user.name })
  },
)

// --- 店舗公開ページ ---
route("GET", pattern("/api/s/:slug"), ({ params }) => {
  const salon = ensureSalon(params.slug)
  const state = getMockState()
  return json({
    salon_name: salon.salon_name,
    description: salon.description,
    address: salon.address,
    business_hours_summary: buildBusinessHoursSummary(state.business_hours),
    booking_page_message: salon.booking_page_message,
    stripe_connect_connected: state.stripe.connected,
    menus: state.menus
      .filter((m) => m.is_public && !m.is_archived)
      .map((m) => ({
        menu_id: m.menu_id,
        name: m.name,
        duration_minutes: m.duration_minutes,
        price: m.price,
        description: m.description,
        image_url: m.image_url,
      })),
  })
})

function buildBusinessHoursSummary(hours: Array<{
  day_of_week: number
  start_time: string
  end_time: string
  is_closed: boolean
}>): string {
  const map = ["月", "火", "水", "木", "金", "土", "日"]
  return hours
    .slice()
    .sort((a, b) => a.day_of_week - b.day_of_week)
    .map((h) => {
      const label = map[h.day_of_week] ?? "?"
      const value = h.is_closed ? "定休日" : `${h.start_time}-${h.end_time}`
      return `${label}: ${value}`
    })
    .join("\n")
}

route("GET", pattern("/api/s/:slug/menus"), ({ url }) => {
  const state = getMockState()
  const trainerId = url.searchParams.get("trainer_id")
  let list = state.menus.filter((m) => m.is_public && !m.is_archived)
  if (trainerId) {
    const trainer = findTrainerById(trainerId)
    if (trainer) {
      const menuIds = new Set(trainer.menu_ids)
      list = list.filter((m) => menuIds.has(m.menu_id))
    }
  }
  return json(
    list.map((m) => ({
      menu_id: m.menu_id,
      name: m.name,
      duration_minutes: m.duration_minutes,
      price: m.price,
      description: m.description,
      image_url: m.image_url,
    })),
  )
})

route("GET", pattern("/api/s/:slug/trainers"), () => {
  const list = getMockState()
    .trainers.filter((t) => t.is_active)
    .sort((a, b) => a.display_order - b.display_order)
    .map((t) => ({
      trainer_id: t.trainer_id,
      name: t.name,
      description: t.description,
      image_url: t.image_url,
    }))
  return json(list)
})

route(
  "GET",
  pattern("/api/s/:slug/booking-rules"),
  () => {
    const r = getMockState().booking_rules
    return json({
      allow_same_day: r.allow_same_day,
      booking_deadline_minutes: r.booking_deadline_minutes,
      cancellation_deadline_hours: r.cancellation_deadline_hours,
      max_advance_days: r.max_advance_days,
    })
  },
)

route("GET", exact("/api/my/booking-rules"), () => {
  const r = getMockState().booking_rules
  return json({
    allow_same_day: r.allow_same_day,
    booking_deadline_minutes: r.booking_deadline_minutes,
    cancellation_deadline_hours: r.cancellation_deadline_hours,
    max_advance_days: r.max_advance_days,
  })
})

route("GET", exact("/api/my/reservation-policies"), () => {
  return json({
    cancellation: {
      title: "キャンセルポリシー",
      summary: "予約時間の24時間前までキャンセルできます。",
      detail_lines: [
        "開始24時間前までキャンセル可能",
        "当日キャンセルはキャンセル不可",
        "キャンセル料は発生する場合があります",
      ],
      cutoff_hours: 24,
    },
    change: {
      title: "予約変更ポリシー",
      summary: "予約時間の24時間前まで変更できます。",
      detail_lines: [
        "開始24時間前まで日時変更可能",
        "当日予約の変更はできません",
      ],
      cutoff_hours: 24,
    },
  })
})

// --- 予約可用性 ---
function generateTimeSlots(dateKey: string, menuDuration: number, incrementMin: number, dow: number) {
  const state = getMockState()
  const hours = state.business_hours.find((h) => h.day_of_week === dow)
  if (!hours || hours.is_closed) return []
  const [sh, sm] = hours.start_time.split(":").map(Number)
  const [eh, em] = hours.end_time.split(":").map(Number)
  const startMin = sh * 60 + sm
  const endMin = eh * 60 + em - menuDuration
  const slots: Array<{ start_at: string; selectable: boolean }> = []
  for (let m = startMin; m <= endMin; m += incrementMin) {
    slots.push({
      start_at: `${dateKey}T${minutesToHHmm(m)}:00+09:00`,
      selectable: true,
    })
  }
  return slots
}

route("GET", pattern("/api/s/:slug/availability"), ({ url }) => {
  const dateKey = url.searchParams.get("date") ?? ""
  const menuId = url.searchParams.get("menu_id") ?? ""
  const menu = findMenuById(menuId)
  const state = getMockState()
  const dow = new Date(`${dateKey}T00:00:00+09:00`).getDay() // Sun=0
  // day_of_week: バックエンドは 0=月...6=日
  const backendDow = (dow + 6) % 7
  const slots = generateTimeSlots(
    dateKey,
    menu?.duration_minutes ?? 60,
    state.booking_rules.slot_increment_minutes,
    backendDow,
  )
  if (state.holidays.includes(dateKey)) return json({ date: dateKey, slots: [] })
  return json({ date: dateKey, slots })
})

route("GET", pattern("/api/s/:slug/availability-dates"), ({ url }) => {
  const from = url.searchParams.get("from_date") ?? ""
  const to = url.searchParams.get("to_date") ?? ""
  const state = getMockState()
  const dates: string[] = []
  if (!from || !to) return json({ dates })
  const cur = new Date(`${from}T00:00:00+09:00`)
  const end = new Date(`${to}T00:00:00+09:00`)
  while (cur <= end) {
    const key = dateKeyFromIso(cur.toISOString())
    const dow = cur.getDay()
    const backendDow = (dow + 6) % 7
    const hours = state.business_hours.find((h) => h.day_of_week === backendDow)
    if (hours && !hours.is_closed && !state.holidays.includes(key)) {
      dates.push(key)
    }
    cur.setDate(cur.getDate() + 1)
  }
  return json({ dates })
})

// --- 顧客用予約 ---
route(
  "POST",
  pattern("/api/s/:slug/reservations"),
  async ({ params, body }) => {
    const state = getMockState()
    const b = bodyRecord(body)
    const menu = findMenuById(String(b.menu_id ?? "")) ?? state.menus[0]
    const startAt = String(b.start_at ?? "")
    const trainerId = (b.trainer_id as string) ?? null
    const trainer = findTrainerById(trainerId)
    const reservation: MockReservation = {
      reservation_id: nextId("res"),
      menu_id: menu?.menu_id ?? null,
      menu_name: menu?.name ?? null,
      start_at: startAt,
      service_end_at: isoAddMinutes(startAt, menu?.duration_minutes ?? 60),
      customer_name: String(b.customer_name ?? "").trim() || "予約者",
      customer_email: String(b.customer_email ?? "").trim(),
      customer_phone: (b.customer_phone as string) ?? null,
      notes: (b.notes as string) ?? null,
      status: "BOOKED",
      customer_id: state.session.customer?.user_id ?? null,
      trainer_id: trainer?.trainer_id ?? null,
      trainer_name: trainer?.name ?? null,
      booking_type: (b.booking_type as "SHIMEI" | "OMAKASE") ?? "OMAKASE",
      source: `customer:${params.slug}`,
      payment_status: "pending",
      payment_method: (b.payment_method as string) ?? null,
      payment_id: null,
      payment_provider: null,
      payment_amount_yen: menu?.price ?? null,
      payment_currency: "JPY",
      payment_record_status: null,
      payment_refund_amount: null,
      payment_paid_at: null,
      created_at: new Date().toISOString(),
      confirmation_token: nextId("tok"),
    }
    state.reservations.push(reservation)
    persistMockState()
    return json(reservationOutJson(reservation), { status: 201 })
  },
)

/*
 * 注意: `/api/s/:slug/reservations/lookup*` と `/api/s/:slug/reservations/:token` は
 * どちらも 5 セグメントで衝突するため、`lookup` 系のルートを先に登録して
 * `:token` にフォールバックさせないようにしている。
 */

route(
  "POST",
  pattern("/api/s/:slug/reservations/lookup/request-otp"),
  async ({ params, body }) => {
    const b = bodyRecord(body)
    const contact = String(b.email ?? b.phone ?? "").trim()
    if (!contact) return badRequest("email or phone required")
    const challenge = {
      challenge_id: nextId("otp"),
      code: "000000",
      destination: contact,
      created_at: new Date().toISOString(),
    }
    const state = getMockState()
    state.otp_challenges.push(challenge)
    persistMockState()
    void params.slug
    return json({
      challenge_id: challenge.challenge_id,
      masked_destination: maskContact(contact),
      message: "モック環境ではワンタイムコードとして 000000 を入力してください。",
    })
  },
)

function maskContact(contact: string): string {
  if (contact.includes("@")) {
    const [local, domain] = contact.split("@")
    return `${local.slice(0, 1)}***@${domain}`
  }
  return contact.replace(/.(?=.{4})/g, "*")
}

route(
  "POST",
  pattern("/api/s/:slug/reservations/lookup/verify-otp"),
  async ({ params, body }) => {
    const state = getMockState()
    const b = bodyRecord(body)
    const challengeId = String(b.challenge_id ?? "")
    const code = String(b.code ?? "").trim()
    const challenge = state.otp_challenges.find((c) => c.challenge_id === challengeId)
    if (!challenge && code !== "000000") return badRequest("invalid code")
    if (challenge && challenge.code !== code && code !== "000000") {
      return badRequest("認証コードが違います。モック環境では 000000 を入力してください。")
    }
    const token = nextId("lookup")
    state.lookup_tokens.push({
      token,
      shop_slug: params.slug,
      contact: challenge?.destination ?? "",
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    })
    persistMockState()
    return json({ lookup_token: token, expires_in_minutes: 30 })
  },
)

route(
  "GET",
  pattern("/api/s/:slug/reservations/lookup"),
  ({ params, request }) => {
    const state = getMockState()
    // Authorization: Bearer <lookup_token> を検証し、
    // OTP を通した連絡先（email/電話）で予約を絞り込む。
    const authHeader = request.headers.get("authorization") ?? ""
    const bearer = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : ""
    const tokenRow = bearer
      ? state.lookup_tokens.find(
          (t) => t.token === bearer && t.shop_slug === params.slug,
        )
      : undefined
    let items = state.reservations
    if (tokenRow?.contact) {
      const c = tokenRow.contact.trim().toLowerCase()
      const matches = state.reservations.filter((r) => {
        const email = r.customer_email?.trim().toLowerCase() ?? ""
        const phone = r.customer_phone?.trim() ?? ""
        return email === c || phone === tokenRow.contact.trim()
      })
      // 該当が無ければモック体験のため全件を返す（Not Found を避ける）。
      items = matches.length > 0 ? matches : state.reservations
    }
    return json(items.map(reservationDetailJson))
  },
)

route(
  "GET",
  pattern("/api/s/:slug/reservations/:token"),
  ({ params }) => {
    const r = getMockState().reservations.find(
      (x) => x.confirmation_token === params.token || x.reservation_id === params.token,
    )
    if (!r) return notFound()
    return json(reservationDetailJson(r))
  },
)

route(
  "PUT",
  pattern("/api/s/:slug/reservations/:token"),
  async ({ params, body }) => {
    const r = getMockState().reservations.find(
      (x) => x.confirmation_token === params.token || x.reservation_id === params.token,
    )
    if (!r) return notFound()
    const b = bodyRecord(body)
    if (typeof b.start_at === "string") {
      const menu = findMenuById(r.menu_id)
      r.start_at = b.start_at
      r.service_end_at = isoAddMinutes(b.start_at, menu?.duration_minutes ?? 60)
    }
    if (typeof b.customer_name === "string") r.customer_name = b.customer_name
    if (typeof b.customer_email === "string") r.customer_email = b.customer_email
    if (b.customer_phone !== undefined) r.customer_phone = (b.customer_phone as string) ?? null
    if (b.notes !== undefined) r.notes = (b.notes as string) ?? null
    persistMockState()
    return json(reservationDetailJson(r))
  },
)

route(
  "POST",
  pattern("/api/s/:slug/reservations/:token/cancel"),
  ({ params }) => {
    const r = getMockState().reservations.find(
      (x) => x.confirmation_token === params.token || x.reservation_id === params.token,
    )
    if (!r) return notFound()
    r.status = "CANCELED"
    persistMockState()
    return json(reservationDetailJson(r))
  },
)

// --- 顧客: my 予約 ---
route("GET", pattern("/api/my/reservations/:id"), ({ params }) => {
  const r = getMockState().reservations.find(
    (x) => x.reservation_id === params.id,
  )
  if (!r) return notFound()
  return json(reservationDetailJson(r))
})

route(
  "POST",
  pattern("/api/my/reservations/:id/cancel"),
  ({ params }) => {
    const r = getMockState().reservations.find(
      (x) => x.reservation_id === params.id,
    )
    if (!r) return notFound()
    r.status = "CANCELED"
    persistMockState()
    return json(reservationDetailJson(r))
  },
)

route(
  "PUT",
  pattern("/api/my/reservations/:id"),
  async ({ params, body }) => {
    const r = getMockState().reservations.find(
      (x) => x.reservation_id === params.id,
    )
    if (!r) return notFound()
    const b = bodyRecord(body)
    if (typeof b.start_at === "string") {
      const menu = findMenuById(r.menu_id)
      r.start_at = b.start_at
      r.service_end_at = isoAddMinutes(b.start_at, menu?.duration_minutes ?? 60)
    }
    if (typeof b.customer_name === "string") r.customer_name = b.customer_name
    if (typeof b.customer_email === "string") r.customer_email = b.customer_email
    if (b.customer_phone !== undefined) r.customer_phone = (b.customer_phone as string) ?? null
    if (b.notes !== undefined) r.notes = (b.notes as string) ?? null
    persistMockState()
    return json(reservationDetailJson(r))
  },
)

// --- Stripe / PayPay 決済 (すべてスキップ相当) ---
route("POST", exact("/api/payments/reservation-intent"), async ({ body }) => {
  const b = bodyRecord(body)
  const menu = findMenuById(String(b.menu_id ?? ""))
  const state = getMockState()
  const intent = {
    payment_intent_id: nextId("pi"),
    client_secret: `mock_secret_${nextId("cs")}`,
    publishable_key: "pk_mock_publishable",
    amount_yen: menu?.price ?? 0,
    currency: "JPY",
  }
  state.payment_intents.push({
    ...intent,
    menu_id: menu?.menu_id ?? "",
    start_at: String(b.start_at ?? ""),
    shop_slug: String(b.shop_slug ?? ""),
  })
  persistMockState()
  return json(intent)
})

route(
  "POST",
  exact("/api/payments/reservation-finalize"),
  async ({ body }) => {
    const state = getMockState()
    const b = bodyRecord(body)
    const menu = findMenuById(String(b.menu_id ?? "")) ?? state.menus[0]
    const trainerId = (b.trainer_id as string) ?? null
    const trainer = findTrainerById(trainerId)
    const reservation: MockReservation = {
      reservation_id: nextId("res"),
      menu_id: menu?.menu_id ?? null,
      menu_name: menu?.name ?? null,
      start_at: String(b.start_at ?? new Date().toISOString()),
      service_end_at: isoAddMinutes(
        String(b.start_at ?? new Date().toISOString()),
        menu?.duration_minutes ?? 60,
      ),
      customer_name: String(b.customer_name ?? "").trim() || "予約者",
      customer_email: String(b.customer_email ?? "").trim(),
      customer_phone: (b.customer_phone as string) ?? null,
      notes: (b.notes as string) ?? null,
      status: "BOOKED",
      customer_id: state.session.customer?.user_id ?? null,
      trainer_id: trainer?.trainer_id ?? null,
      trainer_name: trainer?.name ?? null,
      booking_type: (b.booking_type as "SHIMEI" | "OMAKASE") ?? "OMAKASE",
      source: "credit",
      payment_status: "paid",
      payment_method: String(b.payment_method ?? "credit"),
      payment_id: nextId("pay"),
      payment_provider: "stripe",
      payment_amount_yen: menu?.price ?? null,
      payment_currency: "JPY",
      payment_record_status: "succeeded",
      payment_refund_amount: null,
      payment_paid_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      confirmation_token: nextId("tok"),
    }
    state.reservations.push(reservation)
    persistMockState()
    return json({
      reservation_id: reservation.reservation_id,
      confirmation_token: reservation.confirmation_token,
      payment_id: reservation.payment_id,
      payment_status: reservation.payment_status,
      payment_method: reservation.payment_method,
    })
  },
)

route(
  "POST",
  exact("/api/payments/paypay/checkout"),
  async ({ body }) => {
    const state = getMockState()
    const b = bodyRecord(body)
    const menu = findMenuById(String(b.menu_id ?? "")) ?? state.menus[0]
    const paymentId = nextId("pp")
    const trainerId = (b.trainer_id as string) ?? null
    const trainer = findTrainerById(trainerId)
    const reservation: MockReservation = {
      reservation_id: nextId("res"),
      menu_id: menu?.menu_id ?? null,
      menu_name: menu?.name ?? null,
      start_at: String(b.start_at ?? new Date().toISOString()),
      service_end_at: isoAddMinutes(
        String(b.start_at ?? new Date().toISOString()),
        menu?.duration_minutes ?? 60,
      ),
      customer_name: String(b.customer_name ?? "").trim() || "予約者",
      customer_email: String(b.customer_email ?? "").trim(),
      customer_phone: (b.customer_phone as string) ?? null,
      notes: (b.notes as string) ?? null,
      status: "BOOKED",
      customer_id: state.session.customer?.user_id ?? null,
      trainer_id: trainer?.trainer_id ?? null,
      trainer_name: trainer?.name ?? null,
      booking_type: (b.booking_type as "SHIMEI" | "OMAKASE") ?? "OMAKASE",
      source: "paypay",
      payment_status: "pending",
      payment_method: "paypay",
      payment_id: paymentId,
      payment_provider: "paypay",
      payment_amount_yen: menu?.price ?? null,
      payment_currency: "JPY",
      payment_record_status: "pending",
      payment_refund_amount: null,
      payment_paid_at: null,
      created_at: new Date().toISOString(),
      confirmation_token: nextId("tok"),
    }
    state.reservations.push(reservation)
    persistMockState()
    return json({
      payment_id: paymentId,
      merchant_payment_id: paymentId,
      redirect_url: `${window.location.origin}/user/reservation/paypay-return?merchantPaymentId=${paymentId}`,
      payment_status: "pending",
    })
  },
)

route(
  "POST",
  exact("/api/payments/paypay/finalize"),
  async ({ body }) => {
    const b = bodyRecord(body)
    const state = getMockState()
    const paymentId = String(b.merchant_payment_id ?? "")
    const reservation = state.reservations.find((r) => r.payment_id === paymentId)
    if (!reservation) return notFound()
    reservation.payment_status = "paid"
    reservation.payment_record_status = "succeeded"
    reservation.payment_paid_at = new Date().toISOString()
    persistMockState()
    return json({
      reservation_id: reservation.reservation_id,
      confirmation_token: reservation.confirmation_token,
      payment_id: reservation.payment_id,
      payment_status: reservation.payment_status,
      payment_method: reservation.payment_method,
    })
  },
)

// --- 開発ログ書込エンドポイント（vite の plugin 相当） ---
route("POST", exact("/__log/reservation-operations"), () => noContent())

/* ---------------------------------------------------------------------------
 * インストール
 * -------------------------------------------------------------------------*/
let installed = false

export function installFrontendMock(): void {
  if (installed) return
  installed = true
  if (typeof window === "undefined") return

  const originalFetch = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const req = input instanceof Request ? input : new Request(input, init)
    let url: URL
    try {
      url = new URL(req.url, window.location.origin)
    } catch {
      return originalFetch(input as RequestInfo, init)
    }
    if (url.origin !== window.location.origin) {
      return originalFetch(input as RequestInfo, init)
    }
    const method = req.method.toUpperCase()
    const path = url.pathname
    if (!path.startsWith("/api/") && !path.startsWith("/__log/")) {
      return originalFetch(input as RequestInfo, init)
    }

    for (const route of routes) {
      if (route.method !== method) continue
      const params = route.match(url)
      if (!params) continue
      let body: unknown = null
      if (method !== "GET" && method !== "HEAD" && method !== "DELETE") {
        body = await readJsonBody(req)
      }
      try {
        const res = await route.handle({ url, params, body, request: req })
        return res
      } catch (error) {
        console.warn("[mockFetch] handler error", error, path)
        return json({ detail: "mock handler failure" }, { status: 500 })
      }
    }

    console.warn(`[mockFetch] no handler for ${method} ${path}`)
    return json({ detail: "not mocked" }, { status: 404 })
  }
}
