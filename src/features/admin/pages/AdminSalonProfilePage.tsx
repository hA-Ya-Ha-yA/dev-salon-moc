import { Pencil, X } from "lucide-react"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Link, useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ROUTES } from "@/constants/routes"
import { putAdminProfile } from "@/features/admin/api/adminProfileApi"
import { fetchAdminSalonProfile } from "@/features/admin/api/adminSalonProfileApi"
import { useAdminProfile } from "@/features/auth/context/AdminProfileContext"
import {
  InitialSetupAddressFields,
  type InitialSetupAddressValue,
} from "@/features/auth/components/InitialSetupAddressFields"
import {
  composeSalonAddress,
  parseSalonAddress,
} from "@/features/auth/lib/formatSalonAddress"
import { cn } from "@/lib/utils"

const TEXTAREA_CLASS =
  "min-h-14 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm leading-snug outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"

const EMPTY_ADDRESS: InitialSetupAddressValue = {
  postalCode: "",
  prefecture: "",
  municipality: "",
  street: "",
  building: "",
}

type ProfileFieldKey =
  | "salonName"
  | "address"
  | "phone"
  | "salonMessage"
  | "salonDescription"
  | "cancelPolicy"
  | "instagramUrl"
  | "lineOfficialUrl"
  | "websiteUrl"

type ProfileFieldDef = {
  key: ProfileFieldKey
  label: string
  required?: boolean
  description?: string
}

const PROFILE_FIELDS: ProfileFieldDef[] = [
  { key: "salonName", label: "サロン名", required: true },
  { key: "address", label: "住所", required: true },
  { key: "phone", label: "電話番号", required: true },
  {
    key: "salonMessage",
    label: "サロンメッセージ",
    description: "予約ページ上部に表示します",
  },
  { key: "salonDescription", label: "サロン紹介文" },
  { key: "cancelPolicy", label: "キャンセルポリシー文" },
  { key: "instagramUrl", label: "Instagram URL" },
  { key: "lineOfficialUrl", label: "LINE公式アカウントURL" },
  { key: "websiteUrl", label: "WebサイトURL" },
]

function validateOptionalUrl(value: string, label: string): string | null {
  const v = value.trim()
  if (!v) return null
  if (v.length > 500) return `${label}は500文字以内で入力してください。`
  try {
    const parsed = new URL(v)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return `${label}は http:// または https:// で始まるURLを入力してください。`
    }
  } catch {
    return `${label}は有効なURL形式で入力してください。`
  }
  return null
}

function displayOptional(value: string): string {
  const trimmed = value.trim()
  return trimmed || "（未設定）"
}

function displayRequired(value: string): string {
  const trimmed = value.trim()
  return trimmed || "（未入力）"
}

function cloneAddress(value: InitialSetupAddressValue): InitialSetupAddressValue {
  return { ...value }
}

type FieldSnapshot = string | InitialSetupAddressValue

export function AdminSalonProfilePage() {
  const navigate = useNavigate()
  const adminProfile = useAdminProfile()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [loadError, setLoadError] = useState("")
  const [showSaveConfirm, setShowSaveConfirm] = useState(false)
  const [editingKeys, setEditingKeys] = useState<Set<ProfileFieldKey>>(new Set())
  const [editSnapshots, setEditSnapshots] = useState<
    Partial<Record<ProfileFieldKey, FieldSnapshot>>
  >({})

  const [salonName, setSalonName] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState<InitialSetupAddressValue>(EMPTY_ADDRESS)
  const [salonMessage, setSalonMessage] = useState("")
  const [salonDescription, setSalonDescription] = useState("")
  const [cancelPolicy, setCancelPolicy] = useState("")
  const [instagramUrl, setInstagramUrl] = useState("")
  const [lineOfficialUrl, setLineOfficialUrl] = useState("")
  const [websiteUrl, setWebsiteUrl] = useState("")

  const composedAddress = useMemo(
    () =>
      composeSalonAddress({
        prefecture: address.prefecture,
        municipality: address.municipality,
        street: address.street,
        building: address.building || undefined,
      }),
    [address],
  )

  useEffect(() => {
    let mounted = true
    void fetchAdminSalonProfile()
      .then((profile) => {
        if (!mounted) return
        if (!profile) {
          setLoadError("サロン基本情報が未設定です。初期設定を完了してください。")
          return
        }
        setSalonName(
          profile.salon_name.trim() || adminProfile.salonName?.trim() || "",
        )
        setPhone(profile.phone ?? "")
        const parsed = parseSalonAddress(profile.address ?? "")
        setAddress({
          postalCode: parsed.postalCode,
          prefecture: parsed.prefecture,
          municipality: parsed.municipality,
          street: parsed.street,
          building: parsed.building ?? "",
        })
        setSalonMessage(profile.booking_page_message ?? "")
        setSalonDescription(profile.description ?? "")
        setCancelPolicy(profile.cancellation_policy_text ?? "")
        setInstagramUrl(profile.instagram_url ?? "")
        setLineOfficialUrl(profile.line_url ?? "")
        setWebsiteUrl(profile.website_url ?? "")
      })
      .catch(() => {
        if (!mounted) return
        setLoadError("サロン基本情報の取得に失敗しました。時間をおいて再度お試しください。")
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  function captureSnapshot(key: ProfileFieldKey): FieldSnapshot {
    switch (key) {
      case "salonName":
        return salonName
      case "address":
        return cloneAddress(address)
      case "phone":
        return phone
      case "salonMessage":
        return salonMessage
      case "salonDescription":
        return salonDescription
      case "cancelPolicy":
        return cancelPolicy
      case "instagramUrl":
        return instagramUrl
      case "lineOfficialUrl":
        return lineOfficialUrl
      case "websiteUrl":
        return websiteUrl
      default:
        return ""
    }
  }

  function applySnapshot(key: ProfileFieldKey, snapshot: FieldSnapshot) {
    switch (key) {
      case "salonName":
        setSalonName(snapshot as string)
        break
      case "address":
        setAddress(snapshot as InitialSetupAddressValue)
        break
      case "phone":
        setPhone(snapshot as string)
        break
      case "salonMessage":
        setSalonMessage(snapshot as string)
        break
      case "salonDescription":
        setSalonDescription(snapshot as string)
        break
      case "cancelPolicy":
        setCancelPolicy(snapshot as string)
        break
      case "instagramUrl":
        setInstagramUrl(snapshot as string)
        break
      case "lineOfficialUrl":
        setLineOfficialUrl(snapshot as string)
        break
      case "websiteUrl":
        setWebsiteUrl(snapshot as string)
        break
      default:
        break
    }
  }

  function startEdit(key: ProfileFieldKey) {
    setEditSnapshots((prev) => ({ ...prev, [key]: captureSnapshot(key) }))
    setEditingKeys((prev) => new Set(prev).add(key))
    setError("")
  }

  function cancelEdit(key: ProfileFieldKey) {
    const snapshot = editSnapshots[key]
    if (snapshot !== undefined) {
      applySnapshot(key, snapshot)
    }
    setEditSnapshots((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    setEditingKeys((prev) => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
    setError("")
  }

  function getDisplayText(key: ProfileFieldKey): string {
    switch (key) {
      case "salonName":
        return displayRequired(salonName)
      case "address":
        return displayRequired(composedAddress)
      case "phone":
        return displayRequired(phone)
      case "salonMessage":
        return displayOptional(salonMessage)
      case "salonDescription":
        return displayOptional(salonDescription)
      case "cancelPolicy":
        return displayOptional(cancelPolicy)
      case "instagramUrl":
        return displayOptional(instagramUrl)
      case "lineOfficialUrl":
        return displayOptional(lineOfficialUrl)
      case "websiteUrl":
        return displayOptional(websiteUrl)
      default:
        return ""
    }
  }

  function renderEditor(key: ProfileFieldKey): ReactNode {
    switch (key) {
      case "salonName":
        return (
          <Input
            id="salon-name"
            value={salonName}
            onChange={(e) => {
              setSalonName(e.target.value)
              setError("")
            }}
            maxLength={200}
            disabled={saving}
            autoFocus
          />
        )
      case "address":
        return (
          <InitialSetupAddressFields
            value={address}
            onChange={(next) => {
              setAddress(next)
              setError("")
            }}
            disabled={saving}
          />
        )
      case "phone":
        return (
          <Input
            id="salon-phone"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value)
              setError("")
            }}
            inputMode="numeric"
            pattern="[0-9]{1,20}"
            maxLength={20}
            placeholder="0312345678"
            disabled={saving}
            autoFocus
          />
        )
      case "salonMessage":
        return (
          <textarea
            id="salon-message"
            className={TEXTAREA_CLASS}
            value={salonMessage}
            onChange={(e) => {
              setSalonMessage(e.target.value)
              setError("")
            }}
            disabled={saving}
            autoFocus
          />
        )
      case "salonDescription":
        return (
          <textarea
            id="salon-description"
            className={`${TEXTAREA_CLASS} min-h-20`}
            value={salonDescription}
            onChange={(e) => {
              setSalonDescription(e.target.value)
              setError("")
            }}
            disabled={saving}
            autoFocus
          />
        )
      case "cancelPolicy":
        return (
          <textarea
            id="cancel-policy"
            className={`${TEXTAREA_CLASS} min-h-20`}
            value={cancelPolicy}
            onChange={(e) => {
              setCancelPolicy(e.target.value)
              setError("")
            }}
            disabled={saving}
            autoFocus
          />
        )
      case "instagramUrl":
        return (
          <Input
            id="instagram-url"
            value={instagramUrl}
            onChange={(e) => {
              setInstagramUrl(e.target.value)
              setError("")
            }}
            maxLength={500}
            disabled={saving}
            autoFocus
          />
        )
      case "lineOfficialUrl":
        return (
          <Input
            id="line-url"
            value={lineOfficialUrl}
            onChange={(e) => {
              setLineOfficialUrl(e.target.value)
              setError("")
            }}
            maxLength={500}
            disabled={saving}
            autoFocus
          />
        )
      case "websiteUrl":
        return (
          <Input
            id="website-url"
            value={websiteUrl}
            onChange={(e) => {
              setWebsiteUrl(e.target.value)
              setError("")
            }}
            maxLength={500}
            disabled={saving}
            autoFocus
          />
        )
      default:
        return null
    }
  }

  function validateForm(): string | null {
    const trimmedSalonName = salonName.trim()
    if (!trimmedSalonName) {
      return "サロン名は必須です。"
    }
    if (trimmedSalonName.length > 200) {
      return "サロン名は200文字以内で入力してください。"
    }
    if (!address.prefecture.trim()) {
      return "都道府県を選択してください。"
    }
    if (!address.municipality.trim()) {
      return "市区町村を選択してください。"
    }
    if (!address.street.trim()) {
      return "町名・番地を入力してください。"
    }
    if (composedAddress.length > 500) {
      return "住所全体は500文字以内で入力してください。"
    }
    const trimmedPhone = phone.trim()
    if (!trimmedPhone) {
      return "電話番号は必須です。"
    }
    if (!/^\d{1,20}$/.test(trimmedPhone)) {
      return "電話番号は20桁以下の数字のみで入力してください。"
    }

    const igErr = validateOptionalUrl(instagramUrl, "Instagram URL")
    if (igErr) return igErr
    const lineErr = validateOptionalUrl(lineOfficialUrl, "LINE公式アカウントURL")
    if (lineErr) return lineErr
    const webErr = validateOptionalUrl(websiteUrl, "WebサイトURL")
    if (webErr) return webErr

    return null
  }

  const saveSummaryLines = useMemo(
    () => [
      `サロン名: ${displayRequired(salonName)}`,
      `住所: ${displayRequired(composedAddress)}`,
      `電話番号: ${displayRequired(phone)}`,
      `サロンメッセージ: ${displayOptional(salonMessage)}`,
      `サロン紹介文: ${displayOptional(salonDescription)}`,
      `キャンセルポリシー文: ${displayOptional(cancelPolicy)}`,
      `Instagram URL: ${displayOptional(instagramUrl)}`,
      `LINE公式アカウントURL: ${displayOptional(lineOfficialUrl)}`,
      `WebサイトURL: ${displayOptional(websiteUrl)}`,
    ],
    [
      salonName,
      composedAddress,
      phone,
      salonMessage,
      salonDescription,
      cancelPolicy,
      instagramUrl,
      lineOfficialUrl,
      websiteUrl,
    ],
  )

  function handleOpenSaveConfirm() {
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }
    setError("")
    setShowSaveConfirm(true)
  }

  async function confirmSave() {
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      setShowSaveConfirm(false)
      return
    }

    const trimmedSalonName = salonName.trim()
    const trimmedPhone = phone.trim()

    setError("")
    setSaving(true)
    try {
      const profileResult = await putAdminProfile({
        salon_name: trimmedSalonName,
        phone: trimmedPhone,
        address: composedAddress,
        booking_page_message: salonMessage.trim() || null,
        description: salonDescription.trim() || null,
        cancellation_policy_text: cancelPolicy.trim() || null,
        instagram_url: instagramUrl.trim() || null,
        line_url: lineOfficialUrl.trim() || null,
        website_url: websiteUrl.trim() || null,
      })

      if (profileResult.kind !== "ok") {
        const msg =
          profileResult.kind === "conflict"
            ? profileResult.message ||
              "サロン情報の保存で競合が発生しました。値をご確認ください。"
            : profileResult.kind === "unauthorized"
              ? "認証セッションが無効です。再度ログインしてください。"
              : profileResult.message
                ? `サロン情報の保存に失敗しました（${profileResult.message}）。`
                : "サロン情報の保存に失敗しました。時間をおいて再度お試しください。"
        setError(msg)
        return
      }

      navigate(ROUTES.adminSalonSettings, { replace: true })
    } finally {
      setSaving(false)
      setShowSaveConfirm(false)
    }
  }

  const returnTo = ROUTES.adminSalonSettings

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 pb-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">サロン基本情報</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          登録済みの内容を確認し、必要な項目だけ編集して保存できます。
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      ) : loadError ? (
        <p className="text-sm text-destructive" role="alert">
          {loadError}
        </p>
      ) : (
        <>
          <ul className="space-y-1.5">
            {PROFILE_FIELDS.map((field) => {
              const isEditing = editingKeys.has(field.key)
              const text = getDisplayText(field.key)
              const isUnsetOptional = !field.required && text === "（未設定）"
              const isUnsetRequired = field.required && text === "（未入力）"

              return (
                <li key={field.key} className="flex items-start gap-2">
                  <div className="min-w-0 flex-1 rounded-md border border-border bg-card px-3 py-2">
                    {isEditing ? (
                      <div className="space-y-1.5">
                        <div>
                          <p className="text-xs font-medium leading-tight text-foreground">
                            {field.label}
                            {field.required ? (
                              <span className="ml-0.5 text-destructive" title="必須" aria-hidden>
                                ※
                              </span>
                            ) : null}
                          </p>
                          {field.description ? (
                            <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                              {field.description}
                            </p>
                          ) : null}
                        </div>
                        {renderEditor(field.key)}
                      </div>
                    ) : (
                      <div className="flex items-start gap-2 sm:gap-3">
                        <div className="w-[6.5rem] shrink-0 sm:w-28">
                          <p className="text-xs font-medium leading-tight text-foreground">
                            {field.label}
                            {field.required ? (
                              <span className="ml-0.5 text-destructive" title="必須" aria-hidden>
                                ※
                              </span>
                            ) : null}
                          </p>
                          {field.description ? (
                            <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                              {field.description}
                            </p>
                          ) : null}
                        </div>
                        <p
                          className={cn(
                            "min-w-0 flex-1 whitespace-pre-wrap break-words text-sm leading-snug",
                            isUnsetOptional || isUnsetRequired
                              ? "text-muted-foreground"
                              : "text-foreground",
                          )}
                        >
                          {text}
                        </p>
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0 self-center rounded-md px-2.5 text-xs"
                    disabled={saving}
                    onClick={() =>
                      isEditing ? cancelEdit(field.key) : startEdit(field.key)
                    }
                  >
                    {isEditing ? (
                      <>
                        <X className="mr-1 size-3" aria-hidden />
                        編集取消
                      </>
                    ) : (
                      <>
                        <Pencil className="mr-1 size-3" aria-hidden />
                        編集
                      </>
                    )}
                  </Button>
                </li>
              )
            })}
          </ul>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <div className="sticky bottom-0 -mx-1 border-t border-border bg-background/95 px-1 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" disabled={saving} asChild>
                <Link to={returnTo}>キャンセル</Link>
              </Button>
              <Button type="button" disabled={saving} onClick={handleOpenSaveConfirm}>
                変更を保存
              </Button>
            </div>
          </div>

          {showSaveConfirm ? (
            <SalonProfileSaveConfirmModal
              lines={saveSummaryLines}
              saving={saving}
              onClose={() => !saving && setShowSaveConfirm(false)}
              onConfirm={() => void confirmSave()}
            />
          ) : null}
        </>
      )}
    </div>
  )
}

function SalonProfileSaveConfirmModal({
  lines,
  saving,
  onClose,
  onConfirm,
}: {
  lines: string[]
  saving: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  useEffect(() => {
    function handleKeyDown(e: Event) {
      if (e instanceof KeyboardEvent && e.key === "Escape" && !saving) onClose()
    }
    document.addEventListener("keydown", handleKeyDown)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = ""
    }
  }, [onClose, saving])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="salon-profile-save-confirm-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl">
        <h3
          id="salon-profile-save-confirm-title"
          className="text-base font-bold text-neutral-900"
        >
          以下の内容で保存してよろしいですか？
        </h3>
        <ul className="mt-3 max-h-64 space-y-1.5 overflow-y-auto text-sm text-neutral-700">
          {lines.map((line) => (
            <li key={line} className="break-words">
              {line}
            </li>
          ))}
        </ul>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            修正する
          </Button>
          <Button type="button" onClick={onConfirm} disabled={saving}>
            {saving ? "保存中..." : "保存する"}
          </Button>
        </div>
      </div>
    </div>
  )
}
