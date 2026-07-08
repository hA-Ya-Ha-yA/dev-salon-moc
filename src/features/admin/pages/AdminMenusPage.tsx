import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { EyeOff, Pencil, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ROUTES } from "@/constants/routes"
import {
  fetchAdminMenus,
  postAdminMenu,
  putAdminMenu,
  type AdminMenu,
} from "@/features/admin/api/menusApi"

function putPayloadFromMenu(
  m: AdminMenu,
  overrides: { is_archived: boolean; is_public?: boolean },
): Parameters<typeof putAdminMenu>[1] {
  const body: Parameters<typeof putAdminMenu>[1] = {
    name: m.name,
    is_public:
      overrides.is_public !== undefined ? overrides.is_public : m.is_public,
    is_archived: overrides.is_archived,
  }
  if (m.duration_minutes !== undefined) {
    body.duration_minutes = m.duration_minutes
  }
  if (m.price !== undefined) {
    body.price = m.price
  }
  return body
}

function formatPrice(m: AdminMenu): string {
  return typeof m.price === "number"
    ? `¥${m.price.toLocaleString("ja-JP")}`
    : "—"
}

type MenuAddConfirmDraft = {
  name: string
  duration_minutes: number
  price: number
  is_public: boolean
}

function menuDraftToSummaryMenu(draft: MenuAddConfirmDraft): AdminMenu {
  return {
    menu_id: "",
    name: draft.name,
    duration_minutes: draft.duration_minutes,
    price: draft.price,
    is_public: draft.is_public,
    is_archived: false,
  }
}

function MenuDetailSummary({
  m,
  includePublic = false,
}: {
  m: AdminMenu
  includePublic?: boolean
}) {
  return (
    <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3 text-sm">
      <p>
        <span className="text-muted-foreground">メニュー名: </span>
        <span className="font-medium">{m.name}</span>
      </p>
      <p>
        <span className="text-muted-foreground">所要時間: </span>
        {m.duration_minutes != null ? `${m.duration_minutes} 分` : "—"}
      </p>
      <p>
        <span className="text-muted-foreground">価格: </span>
        {formatPrice(m)}
      </p>
      {includePublic ? (
        <p>
          <span className="text-muted-foreground">公開: </span>
          {m.is_public ? "はい" : "いいえ"}
        </p>
      ) : null}
    </div>
  )
}

export function AdminMenusPage() {
  const navigate = useNavigate()
  const [menus, setMenus] = useState<AdminMenu[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const [formOpen, setFormOpen] = useState<"add" | { edit: AdminMenu } | null>(null)
  const [formName, setFormName] = useState("")
  const [formDuration, setFormDuration] = useState("")
  const [formPrice, setFormPrice] = useState("")
  /**
   * チェック＝非表示リスト（`is_public=false`）、未チェック＝メニュー一覧（`is_public=true`）。
   * 新規・編集とも `is_archived` は false のまま（アーカイブ済みは画面に出さない）。
   */
  const [formHidden, setFormHidden] = useState(false)
  const [formError, setFormError] = useState("")
  const [formSaving, setFormSaving] = useState(false)
  /** 新規追加: 入力検証後の登録確認ダイアログ */
  const [addConfirmOpen, setAddConfirmOpen] = useState(false)
  const [addConfirmDraft, setAddConfirmDraft] = useState<MenuAddConfirmDraft | null>(
    null,
  )

  /** メイン一覧から非表示へ */
  const [hideTarget, setHideTarget] = useState<AdminMenu | null>(null)
  const [hideWorking, setHideWorking] = useState(false)
  /** 非表示リストから一覧へ戻す */
  const [restoreTarget, setRestoreTarget] = useState<AdminMenu | null>(null)
  const [restoreWorking, setRestoreWorking] = useState(false)

  const [pageError, setPageError] = useState("")

  const visibleMenus = useMemo(
    () =>
      menus
        .filter((m) => !m.is_archived && m.is_public)
        .sort((a, b) => a.name.localeCompare(b.name, "ja")),
    [menus],
  )

  const hiddenMenus = useMemo(
    () =>
      menus
        .filter((m) => !m.is_archived && !m.is_public)
        .sort((a, b) => a.name.localeCompare(b.name, "ja")),
    [menus],
  )

  const reload = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    setPageError("")
    try {
      const list = await fetchAdminMenus()
      setMenus(list)
    } catch (e) {
      if (e instanceof Error && e.message === "UNAUTHORIZED") {
        navigate(ROUTES.backofficeLogin, { replace: true })
        return
      }
      setLoadError(true)
      setMenus([])
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    void reload()
  }, [reload])

  const openAdd = () => {
    setFormError("")
    setPageError("")
    setFormName("")
    setFormDuration("")
    setFormPrice("")
    setFormHidden(true)
    setAddConfirmOpen(false)
    setAddConfirmDraft(null)
    setFormOpen("add")
  }

  const openEdit = (m: AdminMenu) => {
    setFormError("")
    setPageError("")
    setAddConfirmOpen(false)
    setAddConfirmDraft(null)
    setFormName(m.name)
    setFormDuration(
      m.duration_minutes !== undefined ? String(m.duration_minutes) : "",
    )
    setFormPrice(m.price !== undefined ? String(m.price) : "")
    setFormHidden(!m.is_public)
    setFormOpen({ edit: m })
  }

  const closeForm = () => {
    setFormOpen(null)
    setFormError("")
    setAddConfirmOpen(false)
    setAddConfirmDraft(null)
  }

  const validateMenuFormForAdd = (): MenuAddConfirmDraft | null => {
    const name = formName.trim()
    if (!name) {
      setFormError("メニュー名を入力してください")
      return null
    }
    if (name.length > 200) {
      setFormError("メニュー名は200文字以内で入力してください")
      return null
    }
    const durRaw = formDuration.trim()
    if (!durRaw) {
      setFormError("新規追加時は所要時間（分）を入力してください")
      return null
    }
    const duration_minutes = Number(durRaw)
    if (
      !Number.isFinite(duration_minutes) ||
      duration_minutes <= 0 ||
      !Number.isInteger(duration_minutes)
    ) {
      setFormError("所要時間（分）は正の整数で入力してください")
      return null
    }
    const priceRaw = formPrice.trim()
    if (!priceRaw) {
      setFormError("新規追加時は料金を入力してください")
      return null
    }
    const price = Number(priceRaw)
    if (!Number.isFinite(price) || price < 0 || !Number.isInteger(price)) {
      setFormError("料金は0以上の整数で入力してください")
      return null
    }
    setFormError("")
    return {
      name,
      duration_minutes,
      price,
      is_public: !formHidden,
    }
  }

  /** 新規追加: 入力検証のうえ確認ダイアログへ */
  const requestAddConfirm = () => {
    const draft = validateMenuFormForAdd()
    if (!draft) return
    setAddConfirmDraft(draft)
    setAddConfirmOpen(true)
  }

  /** 新規追加: 確認後に POST */
  const confirmRegisterMenu = () => {
    void (async () => {
      const draft = addConfirmDraft ?? validateMenuFormForAdd()
      if (!draft) {
        setAddConfirmOpen(false)
        return
      }
      setFormSaving(true)
      setFormError("")
      try {
        await postAdminMenu({
          name: draft.name,
          duration_minutes: draft.duration_minutes,
          price: draft.price,
          is_public: draft.is_public,
          is_archived: false,
        })
        const refreshed = await fetchAdminMenus()
        setMenus(
          [...refreshed].sort((a, b) => a.name.localeCompare(b.name, "ja")),
        )
        setAddConfirmOpen(false)
        setAddConfirmDraft(null)
        closeForm()
      } catch (e) {
        if (e instanceof Error && e.message === "UNAUTHORIZED") {
          navigate(ROUTES.backofficeLogin, { replace: true })
          return
        }
        if (e instanceof Error && e.message.startsWith("FETCH_FAILED_")) {
          const [, rawDetail] = e.message.split(":", 2)
          const detail = rawDetail?.trim()
          if (detail) {
            setFormError(`保存に失敗しました: ${detail}`)
          } else {
            setFormError("入力形式がAPI仕様と一致していません。項目を確認してください。")
          }
          return
        }
        setFormError("保存に失敗しました。入力内容とサーバーを確認してください。")
      } finally {
        setFormSaving(false)
      }
    })()
  }

  const submitEditForm = () => {
    void (async () => {
      const name = formName.trim()
      if (!name) {
        setFormError("メニュー名を入力してください")
        return
      }
      if (name.length > 200) {
        setFormError("メニュー名は200文字以内で入力してください")
        return
      }
      const durRaw = formDuration.trim()
      let duration_minutes: number | undefined
      if (durRaw) {
        const n = Number(durRaw)
        if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
          setFormError("所要時間（分）は空欄か、正の整数で入力してください")
          return
        }
        duration_minutes = n
      }
      const priceRaw = formPrice.trim()
      let price: number | undefined
      if (priceRaw) {
        const n = Number(priceRaw)
        if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
          setFormError("料金は0以上の整数で入力してください")
          return
        }
        price = n
      }
      setFormSaving(true)
      setFormError("")
      try {
        if (formOpen !== null && formOpen !== "add") {
          const editMenu = formOpen.edit
          const id = editMenu.menu_id
          const durationForPut =
            duration_minutes ?? editMenu.duration_minutes
          const priceForPut = price ?? editMenu.price
          if (
            durationForPut === undefined ||
            !Number.isFinite(durationForPut) ||
            durationForPut <= 0
          ) {
            setFormError("所要時間（分）を入力するか、既存の値が取得できている必要があります")
            return
          }
          if (
            priceForPut === undefined ||
            !Number.isFinite(priceForPut) ||
            priceForPut < 0 ||
            !Number.isInteger(priceForPut)
          ) {
            setFormError("料金を入力するか、既存の値が取得できている必要があります")
            return
          }
          await putAdminMenu(id, {
            name,
            duration_minutes: durationForPut,
            price: priceForPut,
            is_public: !formHidden,
            is_archived: false,
          })
          const refreshed = await fetchAdminMenus()
          setMenus(
            [...refreshed].sort((a, b) => a.name.localeCompare(b.name, "ja")),
          )
          closeForm()
        }
      } catch (e) {
        if (e instanceof Error && e.message === "UNAUTHORIZED") {
          navigate(ROUTES.backofficeLogin, { replace: true })
          return
        }
        if (e instanceof Error && e.message.startsWith("FETCH_FAILED_")) {
          const [, rawDetail] = e.message.split(":", 2)
          const detail = rawDetail?.trim()
          if (detail) {
            setFormError(`保存に失敗しました: ${detail}`)
          } else {
            setFormError("入力形式がAPI仕様と一致していません。項目を確認してください。")
          }
          return
        }
        setFormError("保存に失敗しました。入力内容とサーバーを確認してください。")
      } finally {
        setFormSaving(false)
      }
    })()
  }

  const confirmHideToList = () => {
    void (async () => {
      if (!hideTarget) return
      setHideWorking(true)
      setPageError("")
      try {
        const id = hideTarget.menu_id
        await putAdminMenu(
          id,
          putPayloadFromMenu(hideTarget, { is_archived: false, is_public: false }),
        )
        setMenus((prev) =>
          prev.map((x) =>
            x.menu_id === id ? { ...x, is_archived: false, is_public: false } : x,
          ),
        )
        setHideTarget(null)
      } catch (e) {
        if (e instanceof Error && e.message === "UNAUTHORIZED") {
          navigate(ROUTES.backofficeLogin, { replace: true })
          return
        }
        setPageError("非表示への更新に失敗しました。ネットワークまたはサーバーを確認してください。")
      } finally {
        setHideWorking(false)
      }
    })()
  }

  const confirmRestoreFromHidden = () => {
    void (async () => {
      if (!restoreTarget) return
      setRestoreWorking(true)
      setPageError("")
      try {
        const m = restoreTarget
        await putAdminMenu(
          m.menu_id,
          putPayloadFromMenu(m, { is_archived: false, is_public: true }),
        )
        const refreshed = await fetchAdminMenus()
        setMenus([...refreshed].sort((a, b) => a.name.localeCompare(b.name, "ja")))
        setRestoreTarget(null)
      } catch (e) {
        if (e instanceof Error && e.message === "UNAUTHORIZED") {
          navigate(ROUTES.backofficeLogin, { replace: true })
          return
        }
        setPageError("一覧への復帰に失敗しました。ネットワークまたはサーバーを確認してください。")
      } finally {
        setRestoreWorking(false)
      }
    })()
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">読み込み中...</p>
  }

  if (loadError) {
    return (
      <div className="space-y-3 rounded-lg border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          メニュー一覧の取得に失敗しました。GET /api/admin/menus を確認してください。
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => void reload()}>
          再試行
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          メニューの登録・表示/非表示の設定を行います．
        </p>
        <Button type="button" size="sm" className="rounded-md" onClick={openAdd}>
          <Plus className="mr-1 size-4" />
          メニュー新規登録
        </Button>
      </div>

      {pageError && (
        <p className="text-sm text-destructive" role="alert">
          {pageError}
        </p>
      )}

      <Card className="border-border shadow-xs">
        <CardHeader>
          <CardTitle className="text-lg">メニュー一覧</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[400px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-2 pr-3 font-medium">名前</th>
                <th className="pb-2 pr-3 font-medium">所要（分）</th>
                <th className="pb-2 pr-3 font-medium">価格</th>
                <th className="pb-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {visibleMenus.map((m) => (
                <tr key={m.menu_id} className="border-b border-border/60">
                  <td className="py-3 pr-3 font-medium">{m.name}</td>
                  <td className="py-3 pr-3 text-muted-foreground">
                    {m.duration_minutes ?? "—"}
                  </td>
                  <td className="py-3 pr-3 text-muted-foreground">{formatPrice(m)}</td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-md"
                        onClick={() => openEdit(m)}
                      >
                        <Pencil className="mr-1 size-3.5" />
                        編集
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-md text-destructive hover:bg-destructive/10"
                        onClick={() => setHideTarget(m)}
                      >
                        <EyeOff className="mr-1 size-3.5" />
                        非表示
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibleMenus.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              表示中のメニューはありません。
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="rounded-lg border border-border bg-muted/50 p-4 shadow-xs">
        <h2 className="mb-3 text-base font-semibold text-foreground">非表示リスト</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          公開オフのメニューです。
        </p>
        <div className="overflow-x-auto rounded-md border border-border/60 bg-muted/30">
          <table className="w-full min-w-[400px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-3 py-2 pr-3 font-medium">名前</th>
                <th className="py-2 pr-3 font-medium">所要（分）</th>
                <th className="py-2 pr-3 font-medium">価格</th>
                <th className="px-3 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {hiddenMenus.map((m) => (
                <tr key={m.menu_id} className="border-b border-border/60 last:border-b-0">
                  <td className="px-3 py-3 pr-3 font-medium">{m.name}</td>
                  <td className="py-3 pr-3 text-muted-foreground">
                    {m.duration_minutes ?? "—"}
                  </td>
                  <td className="py-3 pr-3 text-muted-foreground">{formatPrice(m)}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-md"
                        disabled={restoreWorking}
                        onClick={() => openEdit(m)}
                      >
                        <Pencil className="mr-1 size-3.5" />
                        編集
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-md"
                        disabled={restoreWorking}
                        onClick={() => setRestoreTarget(m)}
                      >
                        <Plus className="mr-1 size-3.5" />
                        メニュー一覧に追加
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {hiddenMenus.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">非表示のメニューはありません。</p>
          ) : null}
        </div>
      </div>

      {formOpen && !(formOpen === "add" && addConfirmOpen) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="menu-form-title"
          onClick={closeForm}
        >
          <Card
            className="w-full max-w-md max-h-[90vh] overflow-y-auto border-border shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <CardTitle id="menu-form-title" className="text-base">
                {formOpen === "add" ? "メニューを追加" : "メニューを編集"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="menu-name">メニュー名</Label>
                <Input
                  id="menu-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  maxLength={200}
                  className="rounded-md"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="menu-duration">所要時間（分）</Label>
                <Input
                  id="menu-duration"
                  type="number"
                  min={1}
                  step={1}
                  value={formDuration}
                  onChange={(e) => setFormDuration(e.target.value)}
                  placeholder={formOpen === "add" ? "必須（例: 60）" : "任意（空欄可）"}
                  className="rounded-md max-w-[200px] font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="menu-price">料金</Label>
                <Input
                  id="menu-price"
                  type="number"
                  min={0}
                  step={1}
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                  placeholder={formOpen === "add" ? "必須（例: 5000）" : "任意（空欄可）"}
                  className="rounded-md max-w-[200px] font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="menu-list-placement"
                  className="flex cursor-pointer items-start gap-2 text-sm"
                >
                  <input
                    id="menu-list-placement"
                    type="checkbox"
                    checked={formHidden}
                    onChange={(e) => setFormHidden(e.target.checked)}
                    className="mt-1 size-4 shrink-0 rounded border border-input"
                  />
                  <span>
                    <span className="font-medium">非表示リストに追加する</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      チェックを入れると非表示リストにメニューが追加され、ユーザには見えません。
                    </span>
                  </span>
                </label>
              </div>
              {formError && (
                <p className="text-sm text-destructive" role="alert">
                  {formError}
                </p>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" className="rounded-md" onClick={closeForm}>
                  キャンセル
                </Button>
                <Button
                  type="button"
                  className="rounded-md"
                  disabled={formSaving}
                  onClick={formOpen === "add" ? requestAddConfirm : submitEditForm}
                >
                  {formSaving ? "保存中..." : "保存"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {formOpen === "add" && addConfirmOpen && addConfirmDraft && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="menu-add-confirm-title"
          onClick={() => !formSaving && setAddConfirmOpen(false)}
        >
          <Card
            className="w-full max-w-md border-border shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <CardTitle id="menu-add-confirm-title" className="text-base">
                登録の確認
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-foreground">
                この内容でメニューを登録しますか？
              </p>
              <MenuDetailSummary
                m={menuDraftToSummaryMenu(addConfirmDraft)}
                includePublic
              />
              <p className="text-xs text-muted-foreground">
                {addConfirmDraft.is_public
                  ? "メニュー一覧に表示され、ユーザーから予約できます。"
                  : "非表示リストに追加され、ユーザーには表示されません。"}
              </p>
              {formError && (
                <p className="text-sm text-destructive" role="alert">
                  {formError}
                </p>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-md"
                  disabled={formSaving}
                  onClick={() => setAddConfirmOpen(false)}
                >
                  キャンセル
                </Button>
                <Button
                  type="button"
                  className="rounded-md"
                  disabled={formSaving}
                  onClick={confirmRegisterMenu}
                >
                  {formSaving ? "登録中..." : "登録"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {restoreTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="menu-restore-title"
          onClick={() => !restoreWorking && setRestoreTarget(null)}
        >
          <Card
            className="w-full max-w-md border-border shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <CardTitle id="menu-restore-title" className="text-base">
                一覧への追加
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-foreground">
                このメニューをメニュー一覧に追加しますか？
              </p>
              <MenuDetailSummary m={restoreTarget} />
              <p className="text-xs text-muted-foreground">
                追加すると公開を「はい」にし、メニュー一覧に表示します。
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-md"
                  disabled={restoreWorking}
                  onClick={() => setRestoreTarget(null)}
                >
                  キャンセル
                </Button>
                <Button
                  type="button"
                  className="rounded-md"
                  disabled={restoreWorking}
                  onClick={confirmRestoreFromHidden}
                >
                  {restoreWorking ? "処理中..." : "追加する"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {hideTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="menu-hide-title"
          onClick={() => !hideWorking && setHideTarget(null)}
        >
          <Card
            className="w-full max-w-md border-border shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <CardTitle id="menu-hide-title" className="text-base">
                非表示の確認
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-foreground">
                このメニューを非表示リストに移動しますか？
              </p>
              <p className="text-xs text-muted-foreground">
                非表示リストへ移すため、公開を「いいえ」にします。アーカイブは変更しません。
              </p>
              <MenuDetailSummary m={hideTarget} />
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-md"
                  disabled={hideWorking}
                  onClick={() => setHideTarget(null)}
                >
                  キャンセル
                </Button>
                <Button
                  type="button"
                  className="rounded-md"
                  disabled={hideWorking}
                  onClick={confirmHideToList}
                >
                  {hideWorking ? "処理中..." : "非表示にする"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
