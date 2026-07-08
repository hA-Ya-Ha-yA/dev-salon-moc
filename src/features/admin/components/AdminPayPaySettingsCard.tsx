import {
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
} from "lucide-react"
import { useCallback, useEffect, useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  deletePayPayCredentials,
  fetchPayPayStatus,
  savePayPayCredentials,
  type PayPayMode,
  type PayPayStatus,
} from "@/features/admin/api/payPaySettingsApi"

const PAYPAY_APPLICATION_URL = "https://paypay.ne.jp/store-online/"
const PAYPAY_DEVELOPER_URL = "https://developer.paypay.ne.jp/"
const IS_DEVELOPMENT = import.meta.env.DEV
type CredentialField = "merchantId" | "apiKey" | "apiSecret"
type CredentialErrors = Partial<Record<CredentialField, string>>

const EMPTY_STATUS: PayPayStatus = {
  configured: false,
  mode: null,
  merchant_id_masked: null,
}

function validateCredential(value: string, label: string, minLength: number, maxLength: number) {
  const normalized = value.trim()
  if (!normalized) return `${label}を入力してください。`
  if (normalized.length < minLength || normalized.length > maxLength) {
    return `${label}は${minLength}文字以上${maxLength}文字以内で入力してください。`
  }
  const hasInvalidCharacter = Array.from(normalized).some((character) => {
    const code = character.charCodeAt(0)
    return /\s/.test(character) || code < 32 || code === 127
  })
  if (hasInvalidCharacter) {
    return `${label}に空白や制御文字は使用できません。`
  }
  return ""
}

function validateCredentials(
  merchantId: string,
  apiKey: string,
  apiSecret: string,
): CredentialErrors {
  const errors: CredentialErrors = {
    merchantId: validateCredential(merchantId, "Merchant ID", 4, 200),
    apiKey: validateCredential(apiKey, "API Key", 8, 500),
    apiSecret: validateCredential(apiSecret, "API Secret", 8, 500),
  }
  if (!errors.apiKey && !errors.apiSecret && apiKey.trim() === apiSecret.trim()) {
    errors.apiSecret = "API SecretにはAPI Keyと異なる値を入力してください。"
  }
  return Object.fromEntries(Object.entries(errors).filter(([, value]) => value))
}

export function AdminPayPaySettingsCard() {
  const [status, setStatus] = useState<PayPayStatus>(EMPTY_STATUS)
  const [mode, setMode] = useState<PayPayMode>("production")
  const [applicationCompleted, setApplicationCompleted] = useState(false)
  const [apiKey, setApiKey] = useState("")
  const [apiSecret, setApiSecret] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [fieldErrors, setFieldErrors] = useState<CredentialErrors>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const loadStatus = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const nextStatus = await fetchPayPayStatus()
      setStatus(nextStatus)
      if (IS_DEVELOPMENT && nextStatus.mode) setMode(nextStatus.mode)
      if (nextStatus.configured) setApplicationCompleted(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "PayPay連携状態の取得に失敗しました。")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  function clearFieldError(field: CredentialField) {
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage("")
    setError("")

    const nextErrors = validateCredentials(merchantId, apiKey, apiSecret)
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      setError("入力内容を確認してください。")
      return
    }

    setSaving(true)
    try {
      const nextStatus = await savePayPayCredentials({
        apiKey,
        apiSecret,
        merchantId,
        mode: IS_DEVELOPMENT ? mode : "production",
      })
      setStatus(nextStatus)
      setApiKey("")
      setApiSecret("")
      setMerchantId("")
      setFieldErrors({})
      setMessage(
        mode === "sandbox"
          ? "PayPay Sandboxの認証情報を保存しました。実際の有効性は未確認です。"
          : "PayPayオンライン決済の認証情報を保存しました。実際の有効性は未確認です。",
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "PayPayの受取設定に失敗しました。")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm("PayPay連携を解除しますか？解除後はPayPay決済を受け付けられません。")) {
      return
    }
    setDeleting(true)
    setMessage("")
    setError("")
    try {
      setStatus(await deletePayPayCredentials())
      setApplicationCompleted(false)
      setMessage("PayPay連携を解除しました。")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "PayPay連携の解除に失敗しました。")
    } finally {
      setDeleting(false)
    }
  }

  const busy = loading || saving || deleting
  const isSandbox = IS_DEVELOPMENT && mode === "sandbox"
  const showCredentialForm = status.configured || isSandbox || applicationCompleted

  return (
    <Card className="rounded-lg border-border shadow-xs">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="size-5" />
              PayPayオンライン決済
            </CardTitle>
            <CardDescription>
              店舗オーナーがPayPayへ申し込み、審査完了後に本番用の連携情報を登録します。
            </CardDescription>
          </div>
          <span
            className={
              status.configured
                ? "w-fit rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                : "w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
            }
          >
            {loading ? "確認中" : status.configured ? "認証情報保存済み" : "未設定"}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <section className="rounded-lg border p-4">
          <div className="flex gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              1
            </span>
            <div className="space-y-3">
              <div>
                <h3 className="font-semibold">PayPayオンライン決済へ申し込む</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  店頭用QR決済とは別の申込です。PayPay公式のオンライン決済申込から手続きを行ってください。
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button asChild>
                  <a href={PAYPAY_APPLICATION_URL} target="_blank" rel="noreferrer">
                    PayPayオンライン決済を申し込む
                    <ExternalLink className="size-4" />
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <a href={PAYPAY_DEVELOPER_URL} target="_blank" rel="noreferrer">
                    PayPay for Developersを開く
                    <ExternalLink className="size-4" />
                  </a>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                申込後、PayPay for Developersのアカウント作成、審査、サイト設定が必要です。
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border p-4">
          <div className="flex gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              2
            </span>
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <h3 className="font-semibold">審査完了後に連携情報を登録する</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {isSandbox
                    ? "PayPay for DevelopersでSandbox用のAPI Key、API Secret、Merchant IDを確認してください。"
                    : "審査完了後、PayPay for Developersで本番用のAPI Key、API Secret、Merchant IDを確認してください。"}
                </p>
              </div>

              {IS_DEVELOPMENT ? (
                <div className="space-y-2 rounded-md border border-dashed border-amber-300 bg-amber-50 p-3">
                  <Label htmlFor="paypay-mode">接続環境（開発時のみ表示）</Label>
                  <select
                    id="paypay-mode"
                    value={mode}
                    onChange={(event) => {
                      setMode(event.target.value as PayPayMode)
                      setMessage("")
                      setError("")
                    }}
                    disabled={busy}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  >
                    <option value="sandbox">Sandbox（開発・テスト用）</option>
                    <option value="production">本番</option>
                  </select>
                  <p className="text-xs text-amber-800">
                    Sandboxの認証情報は本番環境では使用できません。
                  </p>
                </div>
              ) : null}

              {!status.configured && !isSandbox ? (
                <label className="flex cursor-pointer items-start gap-3 rounded-md bg-muted/50 p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={applicationCompleted}
                    onChange={(event) => setApplicationCompleted(event.target.checked)}
                    disabled={busy}
                    className="mt-0.5 size-4 rounded border-input"
                  />
                  <span>PayPayの審査が完了し、本番用の認証情報を取得しました</span>
                </label>
              ) : (
                <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                  <span>
                    {status.configured ? (
                      <>
                        {status.mode === "sandbox" ? "Sandbox" : "本番環境"}の認証情報を保存済みです。
                        Merchant ID:{" "}
                        <span className="font-mono font-medium">{status.merchant_id_masked}</span>
                        <span className="mt-1 block text-xs">
                          PayPay側での有効性は未確認です。テスト決済で動作を確認してください。
                        </span>
                      </>
                    ) : (
                      "Sandbox用の認証情報を入力してください。"
                    )}
                  </span>
                </div>
              )}

              {showCredentialForm ? (
                <form className="space-y-4" onSubmit={handleSubmit} noValidate>
                  {status.mode === "sandbox" ? (
                    <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      現在はSandbox情報が登録されています。本番公開前に本番用の認証情報へ更新してください。
                    </p>
                  ) : null}

                  <div className="space-y-2">
                    <Label htmlFor="paypay-merchant-id">Merchant ID</Label>
                    <Input
                      id="paypay-merchant-id"
                      value={merchantId}
                      onChange={(event) => {
                        setMerchantId(event.target.value)
                        clearFieldError("merchantId")
                      }}
                      autoComplete="off"
                      placeholder={status.merchant_id_masked ?? "Merchant ID"}
                      disabled={busy}
                      aria-invalid={Boolean(fieldErrors.merchantId)}
                      aria-describedby="paypay-merchant-id-error"
                    />
                    {fieldErrors.merchantId ? (
                      <p id="paypay-merchant-id-error" className="text-xs text-destructive">
                        {fieldErrors.merchantId}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="paypay-api-key">API Key</Label>
                      <Input
                        id="paypay-api-key"
                        type="password"
                        value={apiKey}
                        onChange={(event) => {
                          setApiKey(event.target.value)
                          clearFieldError("apiKey")
                        }}
                        autoComplete="new-password"
                        placeholder={status.configured ? "更新する場合は再入力" : "API Key"}
                        disabled={busy}
                        aria-invalid={Boolean(fieldErrors.apiKey)}
                        aria-describedby="paypay-api-key-error"
                      />
                      {fieldErrors.apiKey ? (
                        <p id="paypay-api-key-error" className="text-xs text-destructive">
                          {fieldErrors.apiKey}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="paypay-api-secret">API Secret</Label>
                      <Input
                        id="paypay-api-secret"
                        type="password"
                        value={apiSecret}
                        onChange={(event) => {
                          setApiSecret(event.target.value)
                          clearFieldError("apiSecret")
                        }}
                        autoComplete="new-password"
                        placeholder={status.configured ? "更新する場合は再入力" : "API Secret"}
                        disabled={busy}
                        aria-invalid={Boolean(fieldErrors.apiSecret)}
                        aria-describedby="paypay-api-secret-error"
                      />
                      {fieldErrors.apiSecret ? (
                        <p id="paypay-api-secret-error" className="text-xs text-destructive">
                          {fieldErrors.apiSecret}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <p className="text-xs leading-relaxed text-muted-foreground">
                    入力値は形式検証後に暗号化して保存され、この画面には再表示されません。更新時は3項目をすべて再入力してください。
                  </p>

                  {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
                  {error ? <p className="text-sm text-destructive">{error}</p> : null}

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button type="submit" disabled={busy}>
                      <Save className="size-4" />
                      {saving ? "保存中..." : status.configured ? "連携情報を更新" : "PayPayを連携"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void loadStatus()}
                      disabled={busy}
                    >
                      <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
                      状態を更新
                    </Button>
                    {status.configured ? (
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => void handleDelete()}
                        disabled={busy}
                      >
                        <Trash2 className="size-4" />
                        {deleting ? "解除中..." : "連携を解除"}
                      </Button>
                    ) : null}
                  </div>
                </form>
              ) : null}
            </div>
          </div>
        </section>

        {!showCredentialForm && error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  )
}
