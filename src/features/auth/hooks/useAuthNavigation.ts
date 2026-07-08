import { useNavigate } from "react-router-dom"

import { postAdminLogin, postAdminSignup } from "@/features/auth/api/adminLoginApi"
import { loginCustomer, registerCustomer } from "@/features/auth/api/customerAuthApi"
import { submitMockAuth } from "@/features/auth/api/mockAuthApi"
import type { AuthFormValues } from "@/features/auth/types/auth"
import type { AuthSubmitResult } from "@/features/auth/types/auth"
import { ROUTES } from "@/constants/routes"
import type { AuthAudience, AuthMode, UserRole } from "@/types"

const REDIRECT_BY_ROLE: Record<UserRole, string> = {
  CUSTOMER: ROUTES.userHome,
  ADMIN: ROUTES.adminHome,
  STAFF: ROUTES.adminHome,
}

export function useAuthNavigation(audience: AuthAudience, mode: AuthMode) {
  const navigate = useNavigate()

  async function submit(values: AuthFormValues): Promise<AuthSubmitResult> {
    if (audience === "CUSTOMER_PORTAL") {
      if (mode === "login") {
        const result = await loginCustomer({
          email: values.email,
          password: values.password,
          shopSlug: values.shopSlug,
        })
        if (!result.ok) {
          return { ok: false, reason: "unauthorized", message: result.error }
        }
        navigate(ROUTES.userHome)
        return { ok: true }
      }

      const result = await registerCustomer({
        email: values.email,
        password: values.password,
        name: values.name ?? "",
        phone: values.phone,
        shopSlug: values.shopSlug,
        gender: values.gender,
        birthDate: values.birthDate,
      })
      if (!result.ok) {
        return { ok: false, reason: "generic", message: result.error }
      }
      navigate(ROUTES.userHome)
      return { ok: true }
    }

    if (audience === "BACKOFFICE_PORTAL" && mode === "login") {
      const result = await postAdminLogin({
        email: values.email,
        password: values.password,
      })
      if (result === "ok") {
        navigate(ROUTES.adminHome)
        return { ok: true }
      }
      if (result === "unauthorized") {
        return { ok: false, reason: "unauthorized" }
      }
      return { ok: false, reason: "generic" }
    }

    if (audience === "BACKOFFICE_PORTAL" && mode === "signup") {
      if (values.signupRole !== "ADMIN" && values.signupRole !== "STAFF") {
        return { ok: false, reason: "generic", message: "ロールを選択してください。" }
      }
      const result = await postAdminSignup({
        email: values.email,
        password: values.password,
        name: values.name ?? "",
        role: values.signupRole,
        salonName: values.salonName,
        salonSlug: values.salonSlug,
        shopSlug: values.shopSlug,
        inviteToken: values.inviteToken,
      })
      if (!result.ok) {
        return { ok: false, reason: "generic", message: result.error }
      }
      navigate(ROUTES.adminHome)
      return { ok: true }
    }

    const result = await submitMockAuth(audience, mode, values)

    if (!result.ok) {
      return { ok: false, reason: "generic" }
    }

    navigate(REDIRECT_BY_ROLE[result.role])
    return { ok: true }
  }

  return { submit }
}
