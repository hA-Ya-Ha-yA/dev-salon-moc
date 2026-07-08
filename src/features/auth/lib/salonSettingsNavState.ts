import { ROUTES } from "@/constants/routes"

/** 初期設定・管理画面サロン設定で共有する `location.state` */
export type SalonSettingsFlowNavState = {
  fromInitialSetup?: boolean
  fromBusinessHours?: boolean
  fromBookingRules?: boolean
  /** ダッシュボードのサロン設定から開いた */
  fromAdminSalonSettings?: boolean
  /** 完了・キャンセル時の戻り先（既定: サロン設定一覧） */
  returnTo?: string
  email?: string
}

/** 管理画面 → サロン設定 → 各設定画面 用の state */
export const ADMIN_SALON_SETTINGS_NAV_STATE: SalonSettingsFlowNavState = {
  fromInitialSetup: true,
  fromAdminSalonSettings: true,
  returnTo: ROUTES.adminSalonSettings,
}

export function isAdminSalonSettingsFlow(
  state: SalonSettingsFlowNavState | null | undefined,
): boolean {
  return Boolean(state?.fromAdminSalonSettings)
}

export function resolveAdminSalonReturnTo(
  state: SalonSettingsFlowNavState | null | undefined,
): string {
  const to = state?.returnTo
  return typeof to === "string" && to.startsWith("/") ? to : ROUTES.adminSalonSettings
}

/** 管理画面フローなら `fromAdminSalonSettings` / `returnTo` を引き継ぐ */
export function carryAdminSalonNavState(
  state: SalonSettingsFlowNavState | null | undefined,
  extra: SalonSettingsFlowNavState = {},
): SalonSettingsFlowNavState {
  if (!isAdminSalonSettingsFlow(state)) return extra
  return {
    fromAdminSalonSettings: true,
    returnTo: resolveAdminSalonReturnTo(state),
    ...extra,
  }
}

/** 設定画面への直接アクセスを許可するか（初期設定 or 管理画面から） */
export function canAccessSalonSettingsStep(
  state: SalonSettingsFlowNavState | null | undefined,
  options: { requireBusinessHours?: boolean } = {},
): boolean {
  if (isAdminSalonSettingsFlow(state)) return true
  if (options.requireBusinessHours && state?.fromBusinessHours) return true
  if (state?.fromInitialSetup) return true
  const email = typeof state?.email === "string" ? state.email.trim() : ""
  return email.length > 0
}
