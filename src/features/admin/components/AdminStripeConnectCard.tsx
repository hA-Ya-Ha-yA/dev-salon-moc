import { CreditCard, ExternalLink, RefreshCw } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  fetchStripeConnectStatus,
  startStripeConnectOnboarding,
  type StripeConnectStatus,
} from "@/features/admin/api/stripeConnectApi"

function statusLabel(status: StripeConnectStatus | null): {
  text: string
  className: string
} {
  if (!status) {
    return { text: "Checking", className: "border-slate-200 bg-slate-50 text-slate-700" }
  }
  if (status.connected) {
    return { text: "Connected", className: "border-emerald-200 bg-emerald-50 text-emerald-700" }
  }
  if (status.status === "onboarding" || status.account_id) {
    return { text: "Onboarding", className: "border-amber-200 bg-amber-50 text-amber-700" }
  }
  return { text: "Not connected", className: "border-slate-200 bg-slate-50 text-slate-700" }
}

function maskAccountId(accountId: string | null): string {
  if (!accountId) return ""
  if (accountId.length <= 12) return accountId
  return `${accountId.slice(0, 8)}...${accountId.slice(-4)}`
}

export function AdminStripeConnectCard() {
  const [status, setStatus] = useState<StripeConnectStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState("")

  const loadStatus = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      setStatus(await fetchStripeConnectStatus())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load Stripe Connect status.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  async function handleConnect() {
    setStarting(true)
    setError("")
    try {
      const { onboarding_url } = await startStripeConnectOnboarding()
      window.location.assign(onboarding_url)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to start Stripe Connect.")
      setStarting(false)
    }
  }

  const badge = statusLabel(status)

  return (
    <Card className="rounded-lg border-border shadow-xs">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="size-5" />
              Stripe Connect
            </CardTitle>
            <CardDescription>Manage the Stripe account used for card payments.</CardDescription>
          </div>
          <span
            className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${badge.className}`}
          >
            {loading ? "Checking" : badge.text}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {status?.account_id ? (
          <p className="break-all text-xs text-muted-foreground">
            Account ID:{" "}
            <span className="font-medium text-foreground">{maskAccountId(status.account_id)}</span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Connect Stripe before accepting customer card payments.
          </p>
        )}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" onClick={() => void handleConnect()} disabled={loading || starting}>
            <ExternalLink className="size-4" />
            {status?.connected ? "Open Stripe settings" : "Connect Stripe"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadStatus()}
            disabled={loading || starting}
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
