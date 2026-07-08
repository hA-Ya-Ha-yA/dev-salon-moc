import type { ReactNode } from "react"

type HeaderTone = "plain" | "muted"

const toneClass: Record<HeaderTone, string> = {
  plain: "border-slate-100 bg-white",
  muted: "border-slate-100 bg-slate-50/80",
}

type Props = {
  title: string
  subtitle?: string
  headerTone?: HeaderTone
  children: ReactNode
}

export function UserSectionCard({ title, subtitle, headerTone = "muted", children }: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className={`border-b px-4 py-4 sm:px-6 ${toneClass[headerTone]}`}>
        <h2 className="text-base font-bold text-foreground">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  )
}
