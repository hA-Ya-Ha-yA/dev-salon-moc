import { apiRequest } from "@/lib/apiClient"

export interface StripeConnectStatus {
  connected: boolean
  account_id: string | null
  status: string | null
}

export interface StripeConnectStart {
  onboarding_url: string
}

export async function fetchStripeConnectStatus(): Promise<StripeConnectStatus> {
  return apiRequest<StripeConnectStatus>("/api/admin/stripe/status")
}

export async function startStripeConnectOnboarding(): Promise<StripeConnectStart> {
  return apiRequest<StripeConnectStart>("/api/admin/stripe/connect", {
    method: "POST",
  })
}
