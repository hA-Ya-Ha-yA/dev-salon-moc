import { CreditCard, QrCode, type LucideIcon } from "lucide-react"

export type UserPaymentMethodOption = {
  id: "credit" | "paypay"
  label: string
  icon: LucideIcon
}

export const USER_PAYMENT_METHODS = [
  { id: "credit", label: "クレジットカード", icon: CreditCard },
  { id: "paypay", label: "PayPay", icon: QrCode },
] as const satisfies readonly UserPaymentMethodOption[]
