import municipalitiesByPrefecture from "@/features/auth/data/municipalitiesByPrefecture.json"
import type { JapanesePrefecture } from "@/features/auth/data/japanesePrefectures"

const MUNICIPALITIES = municipalitiesByPrefecture as Record<
  JapanesePrefecture,
  readonly string[]
>

/** 選択した都道府県に属する市区町村一覧（政令指定都市の区を含む） */
export function getMunicipalitiesForPrefecture(
  prefecture: string,
): readonly string[] {
  if (!prefecture) return []
  return MUNICIPALITIES[prefecture as JapanesePrefecture] ?? []
}
