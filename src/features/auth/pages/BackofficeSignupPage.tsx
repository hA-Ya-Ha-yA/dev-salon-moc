import { useSearchParams } from "react-router-dom"

import { AuthFormCard } from "@/features/auth/components/AuthFormCard"
import { BackofficeSignupEmailPage } from "@/features/auth/pages/BackofficeSignupEmailPage"

/**
 * 管理者の新規登録（メール認証フローのエントリポイント）。
 * 旧来のメール+パスワード+ロール入力フォームから、メールアドレス1つだけを
 * 受け取って認証メールを発行する流れに切り替えた。
 * スタッフ招待リンク（inviteToken 付き）の場合のみ、スタッフ登録フォームを表示する。
 */
export function BackofficeSignupPage() {
  const [searchParams] = useSearchParams()
  const inviteToken = searchParams.get("inviteToken")?.trim()

  if (inviteToken) {
    return <AuthFormCard audience="BACKOFFICE_PORTAL" mode="signup" />
  }

  return <BackofficeSignupEmailPage />
}
