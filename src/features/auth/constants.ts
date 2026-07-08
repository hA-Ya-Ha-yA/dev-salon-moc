import type { AuthAudience, AuthMode } from "@/types"

type AuthText = {
  title: string
  description: string
  submitLabel: string
  switchLabel: string
  switchLinkText: string
}

export const AUTH_TEXT: Record<AuthMode, AuthText> = {
  login: {
    title: "ログイン",
    description: "ログインに成功すると、ロールに応じたページへ遷移します。",
    submitLabel: "ログイン",
    switchLabel: "アカウントをお持ちでない方",
    switchLinkText: "新規登録へ",
  },
  signup: {
    title: "新規登録",
    description: "登録したロールに応じたページへ遷移します。",
    submitLabel: "登録して続行",
    switchLabel: "すでにアカウントをお持ちの方",
    switchLinkText: "ログインへ",
  },
}

export const AUTH_AUDIENCE_TEXT: Record<
  AuthAudience,
  {
    title: string
    description: string
  }
> = {
  CUSTOMER_PORTAL: {
    title: "予約者用",
    description: "予約者向けのログイン・新規登録ページです。",
  },
  BACKOFFICE_PORTAL: {
    title: "管理者・スタッフ用",
    description: "管理者・スタッフ向けのログイン・新規登録ページです。",
  },
}
