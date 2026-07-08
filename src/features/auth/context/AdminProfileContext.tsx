import { createContext, useContext, type ReactNode } from "react"

import type { AdminMeProfile } from "@/features/auth/api/adminSessionApi"

const AdminProfileContext = createContext<AdminMeProfile | null>(null)

export function AdminProfileProvider({
  value,
  children,
}: {
  value: AdminMeProfile
  children: ReactNode
}) {
  return (
    <AdminProfileContext.Provider value={value}>{children}</AdminProfileContext.Provider>
  )
}

export function useAdminProfile(): AdminMeProfile {
  const v = useContext(AdminProfileContext)
  if (!v) {
    throw new Error("useAdminProfile must be used within AdminProfileProvider")
  }
  return v
}
