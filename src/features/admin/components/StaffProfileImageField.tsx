import { useCallback, useId, useRef, useState } from "react"
import { ImagePlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { resolvePublicAssetUrl } from "@/lib/mediaUrl"
import {
  TRAINER_PROFILE_IMAGE_ACCEPT,
  uploadTrainerProfileImage,
  validateTrainerProfileImageFile,
} from "@/features/admin/api/trainerImageUploadApi"

type StaffProfileImageFieldProps = {
  value: string
  onChange: (url: string) => void
  disabled?: boolean
  onUploadError?: (message: string) => void
}

export function StaffProfileImageField({
  value,
  onChange,
  disabled = false,
  onUploadError,
}: StaffProfileImageFieldProps) {
  const inputId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const previewSrc = value.trim() ? resolvePublicAssetUrl(value) : ""

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file || disabled || uploading) return
      const validationError = validateTrainerProfileImageFile(file)
      if (validationError) {
        onUploadError?.(validationError)
        return
      }
      setUploading(true)
      const result = await uploadTrainerProfileImage(file)
      setUploading(false)
      if (!result.ok) {
        onUploadError?.(result.message)
        return
      }
      onChange(result.url)
    },
    [disabled, onChange, onUploadError, uploading],
  )

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (disabled || uploading) return
    const file = e.dataTransfer.files?.[0]
    void handleFile(file)
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div
          role="button"
          tabIndex={disabled || uploading ? -1 : 0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              fileInputRef.current?.click()
            }
          }}
          onDragEnter={(e) => {
            e.preventDefault()
            if (!disabled && !uploading) setDragOver(true)
          }}
          onDragOver={(e) => {
            e.preventDefault()
            if (!disabled && !uploading) setDragOver(true)
          }}
          onDragLeave={(e) => {
            e.preventDefault()
            setDragOver(false)
          }}
          onDrop={onDrop}
          onClick={() => {
            if (!disabled && !uploading) fileInputRef.current?.click()
          }}
          className={cn(
            "flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-6 text-center transition-colors",
            dragOver
              ? "border-primary bg-primary/5"
              : "border-input bg-muted/30 hover:border-primary/50",
            (disabled || uploading) && "pointer-events-none opacity-60",
          )}
        >
          <ImagePlus className="size-8 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium">
            {uploading
              ? "アップロード中..."
              : "画像をドラッグ＆ドロップ、またはクリックして選択"}
          </p>
          <p className="text-xs text-muted-foreground">
            JPEG / PNG / WebP / GIF（最大5MB）
          </p>
        </div>
        <input
          ref={fileInputRef}
          id={inputId}
          type="file"
          accept={TRAINER_PROFILE_IMAGE_ACCEPT}
          className="sr-only"
          disabled={disabled || uploading}
          onChange={(e) => {
            const file = e.target.files?.[0]
            void handleFile(file)
            e.target.value = ""
          }}
        />
      </div>

      {previewSrc ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">プレビュー</p>
          <img
            src={previewSrc}
            alt="プロフィール画像プレビュー"
            className="h-24 w-24 rounded-md border border-input object-cover"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || uploading}
            onClick={() => onChange("")}
          >
            画像をクリア
          </Button>
        </div>
      ) : null}
    </div>
  )
}
