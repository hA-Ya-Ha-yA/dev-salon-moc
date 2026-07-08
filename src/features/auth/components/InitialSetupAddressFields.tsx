import { useEffect, useMemo, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getMunicipalitiesForPrefecture } from "@/features/auth/data/japaneseMunicipalities"
import { JAPANESE_PREFECTURES } from "@/features/auth/data/japanesePrefectures"

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"

export type InitialSetupAddressValue = {
  postalCode: string
  prefecture: string
  municipality: string
  street: string
  building: string
}

type InitialSetupAddressFieldsProps = {
  value: InitialSetupAddressValue
  onChange: (next: InitialSetupAddressValue) => void
  disabled?: boolean
}

function RequiredMark() {
  return (
    <span className="ml-0.5 text-destructive" title="必須" aria-hidden>
      ※
    </span>
  )
}

type ZipCloudAddress = {
  address1?: unknown
  address2?: unknown
  address3?: unknown
}

type ZipCloudResponse = {
  status?: unknown
  message?: unknown
  results?: unknown
}

function normalizePostalCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, 7)
}

function pickZipCloudAddress(data: ZipCloudResponse): ZipCloudAddress | null {
  if (data.status !== 200 || !Array.isArray(data.results) || data.results.length === 0) {
    return null
  }
  const first = data.results[0]
  if (!first || typeof first !== "object") return null
  return first as ZipCloudAddress
}

export function InitialSetupAddressFields({
  value,
  onChange,
  disabled = false,
}: InitialSetupAddressFieldsProps) {
  const [postalLookupStatus, setPostalLookupStatus] = useState<
    "idle" | "loading" | "found" | "not_found" | "error"
  >("idle")
  const lastLookedUpPostalCodeRef = useRef("")
  const postalLookupAbortRef = useRef<AbortController | null>(null)
  const currentValueRef = useRef(value)

  useEffect(() => {
    currentValueRef.current = value
  }, [value])

  const municipalities = useMemo(
    () => getMunicipalitiesForPrefecture(value.prefecture),
    [value.prefecture],
  )

  const municipalityDisabled = disabled || !value.prefecture

  function emitChange(next: InitialSetupAddressValue): void {
    currentValueRef.current = next
    onChange(next)
  }

  async function lookupPostalCode(postalCode: string): Promise<void> {
    postalLookupAbortRef.current?.abort()
    const controller = new AbortController()
    postalLookupAbortRef.current = controller
    setPostalLookupStatus("loading")

    try {
      const res = await fetch(
        `https://zipcloud.ibsnet.co.jp/api/search?zipcode=${encodeURIComponent(
          postalCode,
        )}`,
        { signal: controller.signal },
      )
      const data = (await res.json()) as ZipCloudResponse
      const address = pickZipCloudAddress(data)
      if (!address) {
        setPostalLookupStatus("not_found")
        return
      }

      const prefecture = typeof address.address1 === "string" ? address.address1 : ""
      const municipality = typeof address.address2 === "string" ? address.address2 : ""
      const street = typeof address.address3 === "string" ? address.address3 : ""
      if (!prefecture || !municipality) {
        setPostalLookupStatus("not_found")
        return
      }

      if (currentValueRef.current.postalCode !== postalCode) return

      emitChange({
        ...currentValueRef.current,
        postalCode,
        prefecture,
        municipality,
        street: street === "以下に掲載がない場合" ? "" : street,
      })
      setPostalLookupStatus("found")
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return
      setPostalLookupStatus("error")
    }
  }

  function handlePostalCodeChange(raw: string): void {
    const nextPostalCode = normalizePostalCode(raw)
    const nextValue = { ...value, postalCode: nextPostalCode }
    emitChange(nextValue)

    if (nextPostalCode.length !== 7) {
      postalLookupAbortRef.current?.abort()
      lastLookedUpPostalCodeRef.current = ""
      setPostalLookupStatus("idle")
      return
    }

    if (lastLookedUpPostalCodeRef.current === nextPostalCode) return
    lastLookedUpPostalCodeRef.current = nextPostalCode
    void lookupPostalCode(nextPostalCode)
  }

  return (
    <fieldset className="space-y-4" disabled={disabled}>
      <legend className="text-sm font-medium leading-none">
        住所
        <RequiredMark />
      </legend>

      <div className="space-y-2">
        <Label htmlFor="initial-address-postal-code">郵便番号</Label>
        <Input
          id="initial-address-postal-code"
          name="addressPostalCode"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={8}
          value={value.postalCode}
          onChange={(e) => handlePostalCodeChange(e.target.value)}
          placeholder="例: 1500041"
        />
        <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
          {postalLookupStatus === "loading"
            ? "郵便番号から住所を検索しています..."
            : postalLookupStatus === "found"
              ? "郵便番号から住所を入力しました。"
              : postalLookupStatus === "not_found"
                ? "郵便番号に一致する住所が見つかりませんでした。"
                : postalLookupStatus === "error"
                  ? "住所検索に失敗しました。手動で入力してください。"
                  : "7桁入力すると都道府県・市区町村・町名を自動入力します。"}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="initial-address-prefecture">
          都道府県
          <RequiredMark />
        </Label>
        <select
          id="initial-address-prefecture"
          name="addressPrefecture"
          required
          value={value.prefecture}
          onChange={(e) => {
            emitChange({
              ...value,
              prefecture: e.target.value,
              municipality: "",
            })
          }}
          className={SELECT_CLASS}
        >
          <option value="">選択してください</option>
          {JAPANESE_PREFECTURES.map((pref) => (
            <option key={pref} value={pref}>
              {pref}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="initial-address-municipality">
          市区町村
          <RequiredMark />
        </Label>
        <select
          id="initial-address-municipality"
          name="addressMunicipality"
          required
          value={value.municipality}
          disabled={municipalityDisabled}
          onChange={(e) => emitChange({ ...value, municipality: e.target.value })}
          className={SELECT_CLASS}
        >
          <option value="">
            {value.prefecture ? "選択してください" : "先に都道府県を選択してください"}
          </option>
          {municipalities.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="initial-address-street">
          町名・番地
          <RequiredMark />
        </Label>
        <Input
          id="initial-address-street"
          name="addressStreet"
          required
          maxLength={200}
          value={value.street}
          onChange={(e) => emitChange({ ...value, street: e.target.value })}
          placeholder="例: 神南1-2-3"
          autoComplete="address-line1"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="initial-address-building">建物名</Label>
        <Input
          id="initial-address-building"
          name="addressBuilding"
          maxLength={200}
          value={value.building}
          onChange={(e) => emitChange({ ...value, building: e.target.value })}
          placeholder="〇〇ビル 2F"
          autoComplete="address-line2"
        />
        <p className="text-xs text-muted-foreground">任意入力</p>
      </div>
    </fieldset>
  )
}
