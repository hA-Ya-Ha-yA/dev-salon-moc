import { useState } from "react"

type AdminHeaderAvatarProps = {
  /** `admin_users.name`（表示名） */
  name: string
  /** `admin_users.avatar_url` */
  avatarUrl: string | null
}

/**
 * ヘッダー左用。`avatar_url` があるときは画像、NULL のときは表示名を枠内に表示。
 */
export function AdminHeaderAvatar({ name, avatarUrl }: AdminHeaderAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false)
  const trimmedName = name.trim()
  const url = avatarUrl?.trim()
  const showImage = Boolean(url && !imgFailed)

  return (
    <div
      className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-[10px] font-semibold leading-snug text-foreground shadow-xs"
      title={trimmedName || "管理者"}
    >
      {showImage ? (
        <img
          src={url}
          alt={trimmedName ? `${trimmedName}のプロフィール画像` : ""}
          className="size-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span className="line-clamp-3 max-h-[2.75rem] px-1.5 text-center">
          {trimmedName || "—"}
        </span>
      )}
    </div>
  )
}
