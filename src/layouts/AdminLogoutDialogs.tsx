import { Button } from "@/components/ui/button"

type LogoutConfirmDialogProps = {
  open: boolean
  onCancel: () => void
  onConfirm: () => void
  confirming: boolean
  errorMessage?: string | null
}

export function LogoutConfirmDialog({
  open,
  onCancel,
  onConfirm,
  confirming,
  errorMessage,
}: LogoutConfirmDialogProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-confirm-title"
        className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <p id="logout-confirm-title" className="text-base font-medium">
          本当にログアウトしますか？
        </p>
        {errorMessage ? (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={confirming}
            onClick={onCancel}
          >
            いいえ
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={confirming}
            onClick={onConfirm}
          >
            {confirming ? "処理中..." : "はい"}
          </Button>
        </div>
      </div>
    </div>
  )
}

type LogoutSuccessDialogProps = {
  open: boolean
  onDismiss: () => void
}

export function LogoutSuccessDialog({ open, onDismiss }: LogoutSuccessDialogProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-success-title"
        className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-lg"
      >
        <p id="logout-success-title" className="text-base font-medium">
          ログアウトしました。
        </p>
        <p className="mt-2 text-sm text-muted-foreground">ログイン画面に戻ります。</p>
        <div className="mt-6 flex justify-end">
          <Button type="button" size="sm" onClick={onDismiss}>
            OK
          </Button>
        </div>
      </div>
    </div>
  )
}
