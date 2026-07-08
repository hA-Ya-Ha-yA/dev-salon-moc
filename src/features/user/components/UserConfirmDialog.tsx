import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"

type Props = {
  open: boolean
  title: string
  description?: ReactNode
  content?: ReactNode
  onCancel: () => void
  onConfirm: () => void | Promise<void>
  confirmLabel: string
  cancelLabel?: string
  isConfirming?: boolean
  confirmDisabled?: boolean
  cancelDisabled?: boolean
  errorMessage?: string
  variant?: "default" | "destructive"
  showCancelButton?: boolean
}

export function UserConfirmDialog({
  open,
  title,
  description,
  content,
  onCancel,
  onConfirm,
  confirmLabel,
  cancelLabel = "キャンセル",
  isConfirming = false,
  confirmDisabled = false,
  cancelDisabled = false,
  errorMessage,
  variant = "default",
  showCancelButton = true,
}: Props) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-confirm-title"
    >
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6">
        <h3 id="user-confirm-title" className="text-lg font-bold text-foreground">
          {title}
        </h3>
        {description ? <div className="mt-2 text-sm text-muted-foreground">{description}</div> : null}
        {content}
        {errorMessage ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {showCancelButton ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 rounded-xl sm:min-h-9"
              onClick={onCancel}
              disabled={cancelDisabled || isConfirming}
            >
              {cancelLabel}
            </Button>
          ) : null}
          <Button
            type="button"
            variant={variant === "destructive" ? "destructive" : "default"}
            className="min-h-11 rounded-xl sm:min-h-9"
            onClick={() => void onConfirm()}
            disabled={confirmDisabled || isConfirming}
          >
            {isConfirming ? "処理中…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
