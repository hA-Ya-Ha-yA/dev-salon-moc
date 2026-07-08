import mockUsers from "@/features/auth/api/mockUsers.json"
import type { AuthFormValues } from "@/features/auth/types/auth"
import type { MockUser } from "@/features/auth/types/auth"
import type { AuthAudience, AuthMode, UserRole } from "@/types"

const ALLOWED_ROLES_BY_AUDIENCE: Record<AuthAudience, UserRole[]> = {
  CUSTOMER_PORTAL: ["CUSTOMER"],
  BACKOFFICE_PORTAL: ["ADMIN", "STAFF"],
}

export async function submitMockAuth(
  audience: AuthAudience,
  mode: AuthMode,
  payload: AuthFormValues,
) {
  const normalizedEmail = payload.email.trim().toLowerCase()
  const normalizedPassword = payload.password.trim()

  if (!normalizedEmail || !normalizedPassword) {
    return Promise.resolve({ ok: false as const })
  }

  if (mode === "login") {
    const allowedRoles = ALLOWED_ROLES_BY_AUDIENCE[audience]
    const existingUser = (mockUsers as MockUser[]).find(
      (user) =>
        user.email.toLowerCase() === normalizedEmail &&
        user.password_hash === normalizedPassword &&
        allowedRoles.includes(user.role),
    )

    if (!existingUser) {
      return Promise.resolve({ ok: false as const })
    }

    return Promise.resolve({
      ok: true as const,
      role: existingUser.role,
      mode,
      email: existingUser.email,
    })
  }

  const signupRole: UserRole = payload.signupRole ?? "CUSTOMER"
  const allowedSignupRoles = ALLOWED_ROLES_BY_AUDIENCE[audience]

  if (!allowedSignupRoles.includes(signupRole)) {
    return Promise.resolve({ ok: false as const })
  }

  const pseudoId = `u_${Date.now().toString().slice(-6)}`
  const newUser: MockUser = {
    id: pseudoId,
    email: normalizedEmail,
    password_hash: normalizedPassword,
    line_user_id: null,
    role: signupRole,
  }

  return Promise.resolve({
    ok: true as const,
    role: newUser.role,
    mode,
    email: normalizedEmail,
  })
}
