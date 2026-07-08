import { apiRequest } from "@/lib/apiClient"

export type PayPayMode = "sandbox" | "production"

export interface PayPayStatus {
  configured: boolean
  mode: PayPayMode | null
  merchant_id_masked: string | null
}

export interface PayPayCredentialsInput {
  apiKey: string
  apiSecret: string
  merchantId: string
  mode: PayPayMode
}

export async function fetchPayPayStatus(): Promise<PayPayStatus> {
  return apiRequest<PayPayStatus>("/api/admin/paypay/status")
}

export async function savePayPayCredentials(
  input: PayPayCredentialsInput,
): Promise<PayPayStatus> {
  return apiRequest<PayPayStatus>("/api/admin/paypay/credentials", {
    method: "PUT",
    body: {
      api_key: input.apiKey.trim(),
      api_secret: input.apiSecret.trim(),
      merchant_id: input.merchantId.trim(),
      mode: input.mode,
    },
  })
}

export async function deletePayPayCredentials(): Promise<PayPayStatus> {
  return apiRequest<PayPayStatus>("/api/admin/paypay/credentials", {
    method: "DELETE",
  })
}
