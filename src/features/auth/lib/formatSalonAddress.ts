/** サロン住所の入力4項目（salons / salon_profiles の `address` 結合用） */
import { getMunicipalitiesForPrefecture } from "@/features/auth/data/japaneseMunicipalities"
import { JAPANESE_PREFECTURES } from "@/features/auth/data/japanesePrefectures"

export type SalonAddressParts = {
  prefecture: string
  municipality: string
  street: string
  building?: string
}

export type ParsedSalonAddress = SalonAddressParts & {
  postalCode: string
}

/**
 * 「都道府県」「市区町村」「町名・番地」「建物名」を1文字列に結合する。
 * 建物名があるときのみ、その前に半角スペースを入れる。
 */
export function composeSalonAddress(parts: SalonAddressParts): string {
  const prefecture = parts.prefecture.trim()
  const municipality = parts.municipality.trim()
  const street = parts.street.trim()
  const building = parts.building?.trim() ?? ""
  let out = `${prefecture}${municipality}${street}`
  if (building) out += ` ${building}`
  return out
}

/**
 * 保存済みの1行住所を初期設定フォーム用の各項目へできるだけ復元する。
 * 郵便番号は保存されないため空のまま返す。
 */
export function parseSalonAddress(address: string): ParsedSalonAddress {
  const empty: ParsedSalonAddress = {
    postalCode: "",
    prefecture: "",
    municipality: "",
    street: "",
    building: "",
  }
  const trimmed = address.trim()
  if (!trimmed) return empty

  const prefectures = [...JAPANESE_PREFECTURES].sort((a, b) => b.length - a.length)
  let prefecture = ""
  let rest = trimmed
  for (const p of prefectures) {
    if (trimmed.startsWith(p)) {
      prefecture = p
      rest = trimmed.slice(p.length).trim()
      break
    }
  }

  if (!prefecture) {
    return { ...empty, street: trimmed }
  }

  const municipalities = [...getMunicipalitiesForPrefecture(prefecture)].sort(
    (a, b) => b.length - a.length,
  )
  let municipality = ""
  let streetBuilding = rest
  for (const m of municipalities) {
    if (rest.startsWith(m)) {
      municipality = m
      streetBuilding = rest.slice(m.length).trim()
      break
    }
  }

  let street = streetBuilding
  let building = ""
  const spaceIdx = streetBuilding.lastIndexOf(" ")
  if (spaceIdx > 0) {
    street = streetBuilding.slice(0, spaceIdx).trim()
    building = streetBuilding.slice(spaceIdx + 1).trim()
  }

  return { postalCode: "", prefecture, municipality, street, building }
}
