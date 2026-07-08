import { Dumbbell } from "lucide-react"

type AuthBrandingPanelProps = {
  /** 例: 「管理者・スタッフ用」 */
  audienceTitle: string
  /** 例: 管理者向けの説明文 */
  audienceDescription: string
}

/**
 * ログイン / 新規登録で共通の左ブランディングパネル。
 * `AuthFormCard` と同一のマークアップを維持するため、ここに集約する。
 */
export function AuthBrandingPanel({
  audienceTitle,
  audienceDescription,
}: AuthBrandingPanelProps) {
  return (
    <div className="relative hidden w-[45%] overflow-hidden bg-black lg:flex lg:flex-col lg:justify-between">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='4' height='4' viewBox='0 0 4 4' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 3h1v1H1V3zm2-2h1v1H3V1z' fill='%23ffffff' fill-opacity='1'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="relative z-10 px-12 pt-12">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg border border-white/20">
            <Dumbbell className="size-5 text-white" />
          </div>
          <span className="text-sm font-medium tracking-widest text-white/60">予約ポータル</span>
        </div>
      </div>

      <div className="relative z-10 px-12 pb-20">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-white/40">
          {audienceTitle}
        </p>
        <h1 className="mt-4 text-5xl font-bold leading-[1.1] tracking-tight text-white">
          快適な予約体験を
          <br />
          <span className="text-white/50">あなたに</span>
        </h1>
        <div className="mt-8 h-px w-16 bg-white/20" />
        <p className="mt-6 max-w-xs text-sm leading-relaxed text-white/40">{audienceDescription}</p>
      </div>

      <div className="absolute -bottom-32 -right-32 size-64 rounded-full border border-white/[0.04]" />
      <div className="absolute -bottom-20 -right-20 size-40 rounded-full border border-white/[0.06]" />
    </div>
  )
}

/** 小画面用ヘッダー（ログイン / 新規登録で共通） */
export function AuthMobileBrandingHeader() {
  return (
    <div className="flex items-center gap-3 border-b border-neutral-100 px-6 py-4 lg:hidden">
      <div className="flex size-8 items-center justify-center rounded-lg bg-black">
        <Dumbbell className="size-4 text-white" />
      </div>
      <span className="text-xs font-medium tracking-widest text-neutral-400">予約ポータル</span>
    </div>
  )
}
