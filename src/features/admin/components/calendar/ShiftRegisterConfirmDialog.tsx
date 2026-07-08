import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface ShiftRegisterConfirmDialogProps {
  open: boolean
  title?: string
  message?: string
  summary: ReactNode
  saving?: boolean
  error?: string | null
  confirmLabel?: string
  onCancel: () => void
  onConfirm: () => void
}

export function ShiftRegisterConfirmDialog({
  open,
  title = "登録の確認",
  message = "この内容で登録しますか？",
  summary,
  saving = false,
  error = null,
  confirmLabel = "登録",
  onCancel,
  onConfirm,
}: ShiftRegisterConfirmDialogProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={() => !saving && onCancel()}
    >
      <Card
        className="w-full max-w-md border-border shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shift-register-confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader>
          <CardTitle id="shift-register-confirm-title" className="text-base">
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-foreground">{message}</p>
          {summary}
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>
              キャンセル
            </Button>
            <Button type="button" disabled={saving} onClick={onConfirm}>
              {saving ? "登録中…" : confirmLabel}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
