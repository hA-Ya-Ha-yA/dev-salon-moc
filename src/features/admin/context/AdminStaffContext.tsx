import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  deactivateAdminTrainer,
  fetchAdminTrainers,
  postAdminTrainer,
  putAdminTrainer,
} from "@/features/admin/api/trainersApi"
import type { Staff } from "@/features/admin/types/staff"

function isValidHexColor(s: string): boolean {
  const t = s.trim().toLowerCase()
  const h = t.startsWith("#") ? t : `#${t}`
  return /^#[0-9a-f]{6}$/.test(h)
}

function normalizeColorInput(s: string): string {
  const t = s.trim().toLowerCase()
  return t.startsWith("#") ? t : `#${t}`
}

/**
 * `Trainer.display_order` 昇順 → 名前昇順。
 * バックエンドのソートと一致させる。
 */
function sortStaffByDisplayOrder(list: Staff[]): Staff[] {
  return [...list].sort((a, b) => {
    const oa = a.display_order ?? Number.MAX_SAFE_INTEGER
    const ob = b.display_order ?? Number.MAX_SAFE_INTEGER
    if (oa !== ob) return oa - ob
    return a.name.localeCompare(b.name, "ja")
  })
}

export type AddStaffResult =
  | { kind: "ok"; staff: Staff }
  | { kind: "trainer_failed"; message: string }

type AdminStaffContextValue = {
  staffList: Staff[]
  loading: boolean
  /** 初回（または再取得）の一覧取得に失敗したとき */
  staffLoadError: boolean
  refetchStaff: () => Promise<void>
  addStaff: (input: {
    name: string
    color: string
    description?: string
    image_url?: string
    display_order?: number
    /** サロンメニューID。POST /api/admin/trainers の menu_ids にまとめて送る */
    menuIds: string[]
  }) => Promise<AddStaffResult>
  updateStaff: (
    id: string,
    input: {
      name: string
      color: string
      description: string
      image_url: string
      display_order?: number
      menuIds: string[]
    },
  ) => Promise<boolean>
  /**
   * 表示順の入れ替え（`PUT /api/admin/trainers/{id}` を 2 回呼ぶ）。
   * 隣接 2 行の `display_order` をスワップする想定。
   */
  swapStaffDisplayOrder: (a: Staff, b: Staff) => Promise<boolean>
  deleteStaff: (staff: Staff) => Promise<void>
}

const AdminStaffContext = createContext<AdminStaffContextValue | null>(null)

export function AdminStaffProvider({ children }: { children: ReactNode }) {
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [staffLoadError, setStaffLoadError] = useState(false)

  const refetchStaff = useCallback(async () => {
    setLoading(true)
    setStaffLoadError(false)
    try {
      const list = await fetchAdminTrainers()
      setStaffList(list)
    } catch {
      setStaffLoadError(true)
      setStaffList([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refetchStaff()
  }, [refetchStaff])

  const addStaff = useCallback(
    async (input: {
      name: string
      color: string
      description?: string
      image_url?: string
      display_order?: number
      menuIds: string[]
    }): Promise<AddStaffResult> => {
      const name = input.name.trim()
      const color = input.color.trim()
      if (!name || !isValidHexColor(color)) {
        return {
          kind: "trainer_failed",
          message: "入力内容を確認してください",
        }
      }
      const normalized = normalizeColorInput(color)
      const menuIds = input.menuIds
        .map((id) => String(id).trim())
        .filter(Boolean)

      const base: Parameters<typeof postAdminTrainer>[0] = {
        name,
        color: normalized,
        description: input.description?.trim() || undefined,
        image_url: input.image_url?.trim() || undefined,
      }
      if (
        input.display_order !== undefined &&
        Number.isFinite(input.display_order)
      ) {
        base.display_order = Math.round(input.display_order)
      }
      try {
        const created = await postAdminTrainer({
          ...base,
          menu_ids: menuIds,
        })
        if (!created) {
          return {
            kind: "trainer_failed",
            message: "スタッフの登録に失敗しました",
          }
        }
        const withMenus: Staff = {
          ...created,
          menuIds: menuIds.length > 0 ? [...menuIds] : created.menuIds,
        }
        setStaffList((prev) =>
          sortStaffByDisplayOrder([
            ...prev.filter((s) => s.id !== withMenus.id),
            withMenus,
          ]),
        )
        return { kind: "ok", staff: withMenus }
      } catch (e) {
        if (e instanceof Error && e.message === "UNAUTHORIZED") throw e
        return {
          kind: "trainer_failed",
          message: "スタッフの登録に失敗しました",
        }
      }
    },
    [],
  )

  const updateStaff = useCallback(
    async (
      id: string,
      input: {
        name: string
        color: string
        description: string
        image_url: string
        display_order?: number
        menuIds: string[]
      },
    ): Promise<boolean> => {
      const name = input.name.trim()
      const color = input.color.trim()
      if (!name || !isValidHexColor(color)) return false
      const normalized = normalizeColorInput(color)
      const menuIds = input.menuIds
        .map((mid) => String(mid).trim())
        .filter(Boolean)
      try {
        await putAdminTrainer(id, {
          name,
          color: normalized,
          description: input.description,
          image_url: input.image_url,
          display_order: input.display_order,
          menu_ids: menuIds,
        })
        const descTrim = input.description.trim()
        const imgTrim = input.image_url.trim()
        setStaffList((prev) => {
          const idx = prev.findIndex((s) => s.id === id)
          if (idx < 0) return prev
          const next = [...prev]
          const cur = next[idx]
          next[idx] = {
            ...cur,
            name,
            color: normalized,
            description: descTrim || undefined,
            image_url: imgTrim || undefined,
            menuIds: [...menuIds],
            ...(input.display_order !== undefined
              ? { display_order: input.display_order }
              : {}),
          }
          return sortStaffByDisplayOrder(next)
        })
        return true
      } catch (e) {
        if (e instanceof Error && e.message === "UNAUTHORIZED") throw e
        return false
      }
    },
    [],
  )

  const swapStaffDisplayOrder = useCallback(
    async (a: Staff, b: Staff): Promise<boolean> => {
      if (a.id === b.id) return false
      const oa = a.display_order
      const ob = b.display_order
      /**
       * どちらかが未設定だと安定したスワップが組めないため、
       * 一覧の現在順（display_order 昇順）を元に 0 起点で振り直してから入れ替える。
       */
      let newOrderA: number
      let newOrderB: number
      if (
        typeof oa === "number" &&
        Number.isFinite(oa) &&
        typeof ob === "number" &&
        Number.isFinite(ob) &&
        oa !== ob
      ) {
        newOrderA = ob
        newOrderB = oa
      } else {
        newOrderA = typeof ob === "number" && Number.isFinite(ob) ? ob : 1
        newOrderB = typeof oa === "number" && Number.isFinite(oa) ? oa : 0
        if (newOrderA === newOrderB) {
          newOrderA = newOrderB + 1
        }
      }
      try {
        await putAdminTrainer(a.id, {
          name: a.name,
          color: a.color,
          display_order: newOrderA,
        })
        await putAdminTrainer(b.id, {
          name: b.name,
          color: b.color,
          display_order: newOrderB,
        })
        setStaffList((prev) =>
          sortStaffByDisplayOrder(
            prev.map((s) => {
              if (s.id === a.id) return { ...s, display_order: newOrderA }
              if (s.id === b.id) return { ...s, display_order: newOrderB }
              return s
            }),
          ),
        )
        return true
      } catch (e) {
        if (e instanceof Error && e.message === "UNAUTHORIZED") throw e
        return false
      }
    },
    [],
  )

  const deleteStaff = useCallback(async (staff: Staff): Promise<void> => {
    await deactivateAdminTrainer(staff)
    setStaffList((prev) => prev.filter((s) => s.id !== staff.id))
  }, [])

  const value = useMemo(
    () => ({
      staffList,
      loading,
      staffLoadError,
      refetchStaff,
      addStaff,
      updateStaff,
      swapStaffDisplayOrder,
      deleteStaff,
    }),
    [
      staffList,
      loading,
      staffLoadError,
      refetchStaff,
      addStaff,
      updateStaff,
      swapStaffDisplayOrder,
      deleteStaff,
    ],
  )

  return (
    <AdminStaffContext.Provider value={value}>{children}</AdminStaffContext.Provider>
  )
}

export function useAdminStaff() {
  const ctx = useContext(AdminStaffContext)
  if (!ctx) {
    throw new Error("useAdminStaff must be used within AdminStaffProvider")
  }
  return ctx
}
