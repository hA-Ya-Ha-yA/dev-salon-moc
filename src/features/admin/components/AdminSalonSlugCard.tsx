import { ExternalLink } from "lucide-react"
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { fetchAdminSalonProfile } from "@/features/admin/api/adminSalonProfileApi"

export function AdminSalonSlugCard() {
  const [savedSlug, setSavedSlug] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let mounted = true
    void fetchAdminSalonProfile()
      .then((profile) => {
        if (!mounted) return
        const currentSlug = profile?.slug ?? ""
        setSavedSlug(currentSlug)
      })
      .catch((e) => {
        if (!mounted) return
        setError(e instanceof Error ? e.message : "プロフィールの取得に失敗しました。")
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  const publicPath = savedSlug ? `/s/${savedSlug}` : ""
  const publicUrl =
    typeof window !== "undefined" && publicPath ? `${window.location.origin}${publicPath}` : publicPath

  return (
    <Card className="rounded-lg border-border shadow-xs">
      <CardHeader>
        <CardTitle className="text-lg">予約URL</CardTitle>
        <CardDescription>お客様に共有する予約ページURLです。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? <p className="text-sm text-muted-foreground">読み込み中...</p> : null}

        {!loading && publicUrl ? (
          <div className="flex flex-col gap-2 rounded-md border bg-muted/40 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="break-all text-muted-foreground">{publicUrl}</span>
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link to={publicPath} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" />
                開く
              </Link>
            </Button>
          </div>
        ) : null}

        {!loading && !publicUrl ? (
          <p className="text-sm text-muted-foreground">予約URLが未設定です。</p>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  )
}
