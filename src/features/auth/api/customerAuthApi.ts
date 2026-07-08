import { API_BASE } from "@/lib/apiBase"
import { buildSalonApiPath, persistShopSlug, resolveShopSlug } from "@/lib/shopSlug"

interface RegisterPayload {
  email: string
  password: string
  name: string
  phone?: string
  shopSlug?: string
  gender?: string
  birthDate?: string
}

interface RegisterResponse {
  message: string
  user_id: string
  name: string
}

interface ValidationErrorItem {
  loc: (string | number)[]
  msg: string
}

interface LoginPayload {
  email: string
  password: string
  shopSlug?: string
}

interface LoginResponse {
  message: string
  user_id: string
  name: string
}

const FIELD_LABELS: Record<string, string> = {
  email: "Email",
  password: "Password",
  name: "Name",
  phone: "Phone number",
}

const MESSAGE_PATTERNS: [RegExp, string][] = [
  [/string should have at least (\d+) characters/i, "Must be at least $1 characters."],
  [/value is not a valid email address/i, "Please enter a valid email address."],
  [/field required/i, "This field is required."],
  [/string type expected/i, "Please enter text."],
]

function translateValidationMessage(raw: string): string {
  for (const [pattern, replacement] of MESSAGE_PATTERNS) {
    if (pattern.test(raw)) return raw.replace(pattern, replacement)
  }
  return raw
}

function parseErrorDetail(body: unknown): string {
  if (!body || typeof body !== "object") return ""

  const obj = body as Record<string, unknown>
  if (typeof obj.detail === "string") return obj.detail

  if (Array.isArray(obj.detail)) {
    const items = obj.detail as ValidationErrorItem[]
    return items
      .map((item) => {
        const rawField = item.loc.filter((segment) => segment !== "body").join(".")
        const fieldLabel = FIELD_LABELS[rawField] ?? rawField
        const message = translateValidationMessage(item.msg)
        return fieldLabel ? `${fieldLabel}: ${message}` : message
      })
      .join("\n")
  }

  return ""
}

function buildConnectionErrorMessage(cause: unknown): string {
  const base = "API connection failed. Please make sure the backend server is running."
  if (!import.meta.env.DEV) return base
  const detail = cause instanceof Error ? cause.message : String(cause)
  console.error("[customerAuthApi] request failed", cause)
  return `${base} (${detail})`
}

function requireShopSlug(input?: string): { ok: true; shopSlug: string } | { ok: false; error: string } {
  const shopSlug = resolveShopSlug(input)
  if (!shopSlug) {
    return {
      ok: false,
      error: "Shop ID is missing. Open the customer page from the correct salon link and try again.",
    }
  }
  return { ok: true, shopSlug }
}

export async function loginCustomer(payload: LoginPayload): Promise<
  | { ok: true; data: LoginResponse }
  | { ok: false; error: string }
> {
  const slug = requireShopSlug(payload.shopSlug)
  if (!slug.ok) return slug

  try {
    const response = await fetch(`${API_BASE}${buildSalonApiPath(slug.shopSlug, "/auth/login")}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email: payload.email, password: payload.password }),
    })

    if (response.ok) {
      return { ok: true, data: (await response.json()) as LoginResponse }
    }

    const errorBody = await response.json().catch(() => null)
    const message = parseErrorDetail(errorBody) || "Login failed. Please check your credentials."
    return { ok: false, error: message }
  } catch (cause) {
    return { ok: false, error: buildConnectionErrorMessage(cause) }
  }
}

export async function registerCustomer(payload: RegisterPayload): Promise<
  | { ok: true; data: RegisterResponse }
  | { ok: false; error: string }
> {
  const slug = requireShopSlug(payload.shopSlug)
  if (!slug.ok) return slug

  try {
    const response = await fetch(`${API_BASE}${buildSalonApiPath(slug.shopSlug, "/auth/register")}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        email: payload.email,
        password: payload.password,
        name: payload.name,
        phone: payload.phone,
        gender: payload.gender,
        birth_date: payload.birthDate,
      }),
    })

    if (response.ok) {
      return { ok: true, data: (await response.json()) as RegisterResponse }
    }

    const errorBody = await response.json().catch(() => null)
    const message =
      parseErrorDetail(errorBody) || `Registration failed. Please try again. (HTTP ${response.status})`
    return { ok: false, error: message }
  } catch (cause) {
    return { ok: false, error: buildConnectionErrorMessage(cause) }
  }
}

export async function checkCustomerSessionAlive(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/auth/me`, {
      method: "GET",
      credentials: "include",
    })
    return response.ok
  } catch {
    return false
  }
}

export async function getLineLoginUrl(inputShopSlug?: string): Promise<
  | { ok: true; url: string }
  | { ok: false; error: string }
> {
  const slug = requireShopSlug(inputShopSlug)
  if (!slug.ok) return slug

  try {
    persistShopSlug(slug.shopSlug)
    const response = await fetch(`${API_BASE}${buildSalonApiPath(slug.shopSlug, "/auth/line/url")}`, {
      credentials: "include",
    })

    if (response.ok) {
      return { ok: true, url: ((await response.json()) as { url: string }).url }
    }

    return { ok: false, error: "Failed to load LINE login URL." }
  } catch (cause) {
    return { ok: false, error: buildConnectionErrorMessage(cause) }
  }
}

export async function lineCallback(code: string, state?: string): Promise<
  | { ok: true; data: { message: string; user_id: string; name: string } }
  | { ok: false; error: string }
> {
  const slug = requireShopSlug()
  if (!slug.ok) return slug

  try {
    const response = await fetch(`${API_BASE}${buildSalonApiPath(slug.shopSlug, "/auth/line/callback")}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ code, state }),
    })

    if (response.ok) {
      const data = (await response.json()) as { message: string; user_id: string; name: string }
      return { ok: true, data }
    }

    const errorBody = await response.json().catch(() => null)
    const message = parseErrorDetail(errorBody) || "LINE login failed. Please try again."
    return { ok: false, error: message }
  } catch (cause) {
    return { ok: false, error: buildConnectionErrorMessage(cause) }
  }
}
