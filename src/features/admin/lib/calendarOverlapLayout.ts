/**
 * タイムライン上の区間を、重なりがあれば横に分割して配置する（予約カレンダー用）。
 * 区間は [start, end) 分（end は含まない）として重なり判定する。
 */

export type IntervalForLayout = {
  id: string
  /** タイムライン原点からの開始分（以上） */
  start: number
  /** タイムライン原点からの終了分（未満） */
  end: number
}

export type OverlapLayoutResult = {
  id: string
  /** 0 から始まる列インデックス */
  column: number
  /** この区間が属する重なりグループで使う列数（幅 = 100 / columnCount %） */
  columnCount: number
}

function overlaps(a: IntervalForLayout, b: IntervalForLayout): boolean {
  return a.start < b.end && b.start < a.end
}

/**
 * 開始が早い順、同開始なら終わりが遅い順で貪欲に列を割り当て、
 * 各区間について「自分と重なる区間たち」の列の最大値から列数を求める。
 */
export function layoutOverlappingIntervals(
  items: IntervalForLayout[],
): OverlapLayoutResult[] {
  if (items.length === 0) return []

  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end)

  type Active = IntervalForLayout & { column: number }
  const active: Active[] = []
  const columnById = new Map<string, number>()

  for (const iv of sorted) {
    for (let i = active.length - 1; i >= 0; i--) {
      if (active[i].end <= iv.start) active.splice(i, 1)
    }
    const used = new Set(active.map((a) => a.column))
    let c = 0
    while (used.has(c)) c++
    active.push({ ...iv, column: c })
    columnById.set(iv.id, c)
  }

  return items.map((iv) => {
    const overlapping = items.filter((o) => overlaps(o, iv))
    const maxCol = Math.max(...overlapping.map((o) => columnById.get(o.id)!), 0)
    return {
      id: iv.id,
      column: columnById.get(iv.id)!,
      columnCount: maxCol + 1,
    }
  })
}
