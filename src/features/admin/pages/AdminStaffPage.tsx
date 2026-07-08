import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  countFutureReservationsForTrainer,
  fetchAllReservationsForAdmin,
} from "@/features/admin/api/reservationsApi"
import { fetchAdminMenus } from "@/features/admin/api/menusApi"
import { fetchAdminTrainerById } from "@/features/admin/api/trainersApi"
import { isStaffNameTaken } from "@/features/admin/api/staffApi"
import { postStaffInvitation } from "@/features/admin/api/staffInvitationsApi"
import { useAdminStaff } from "@/features/admin/context/AdminStaffContext"
import { ROUTES } from "@/constants/routes"
import type { Staff } from "@/features/admin/types/staff"

const COLOR_PRESETS = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#a855f7",
  "#ef4444",
  "#06b6d4",
  "#ec4899",
  "#64748b",
]

function normalizeHex(c: string): string {
  const t = c.trim()
  if (/^#[0-9A-Fa-f]{6}$/.test(t)) return t.toLowerCase()
  if (/^[0-9A-Fa-f]{6}$/.test(t)) return `#${t.toLowerCase()}`
  return t
}

export function AdminStaffPage() {
  const navigate = useNavigate()
  const {
    staffList,
    loading,
    staffLoadError,
    refetchStaff,
    addStaff,
    updateStaff,
    deleteStaff,
  } = useAdminStaff()

  const [formOpen, setFormOpen] = useState<"add" | { edit: Staff } | null>(null)
  const [formName, setFormName] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formImageUrl, setFormImageUrl] = useState("")
  const [formDisplayOrder, setFormDisplayOrder] = useState("")
  const [formColor, setFormColor] = useState("#6366f1")
  /** 追加フォームのみ。`GET /api/admin/menus` の並びで POST 順を決める */
  const [salonMenus, setSalonMenus] = useState<Awaited<
    ReturnType<typeof fetchAdminMenus>
  >>([])
  const [menusLoading, setMenusLoading] = useState(false)
  const [menusLoadError, setMenusLoadError] = useState(false)
  const [selectedMenuIds, setSelectedMenuIds] = useState<string[]>([])
  const [formError, setFormError] = useState("")
  const [formSaving, setFormSaving] = useState(false)
  const [trainerDetailLoading, setTrainerDetailLoading] = useState(false)
  const [trainerDetailError, setTrainerDetailError] = useState("")
  /** 追加フロー: 入力後の登録確認ダイアログ */
  const [addConfirmOpen, setAddConfirmOpen] = useState(false)
  /** 編集フロー: 入力後の保存確認ダイアログ */
  const [editConfirmOpen, setEditConfirmOpen] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Staff | null>(null)
  const [pageError, setPageError] = useState("")
  const [deleteWorking, setDeleteWorking] = useState(false)
  const [deletePrecheckLoading, setDeletePrecheckLoading] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteSaving, setInviteSaving] = useState(false)
  const [inviteResult, setInviteResult] = useState<{
    email: string
    signupUrl: string
    expiresAt: string
  } | null>(null)
  const [inviteError, setInviteError] = useState("")

  const createInvite = async () => {
    const email = inviteEmail.trim()
    if (!email) {
      setInviteError("招待するメールアドレスを入力してください。")
      return
    }
    setInviteSaving(true)
    setInviteError("")
    setInviteResult(null)
    try {
      const result = await postStaffInvitation({ email })
      if (result.kind === "unauthorized") {
        navigate(ROUTES.backofficeLogin, { replace: true })
        return
      }
      if (result.kind !== "ok") {
        setInviteError(
          "message" in result ? result.message : "スタッフ招待の作成に失敗しました。",
        )
        return
      }
      setInviteResult({
        email: result.email,
        signupUrl: result.signupUrl,
        expiresAt: result.expiresAt,
      })
      setInviteEmail("")
    } catch (e) {
      if (e instanceof Error && e.message === "UNAUTHORIZED") {
        navigate(ROUTES.backofficeLogin, { replace: true })
        return
      }
      setInviteError(
        e instanceof Error ? e.message : "スタッフ招待の作成に失敗しました。",
      )
    } finally {
      setInviteSaving(false)
    }
  }

  const openAdd = () => {
    setFormError("")
    setPageError("")
    setFormName("")
    setFormDescription("")
    setFormImageUrl("")
    setFormDisplayOrder("")
    setFormColor(COLOR_PRESETS[staffList.length % COLOR_PRESETS.length])
    setSelectedMenuIds([])
    setSalonMenus([])
    setMenusLoadError(false)
    setAddConfirmOpen(false)
    setEditConfirmOpen(false)
    setTrainerDetailLoading(false)
    setTrainerDetailError("")
    setFormOpen("add")
  }

  const menuFormActive =
    formOpen === "add" ||
    (formOpen !== null &&
      typeof formOpen === "object" &&
      "edit" in formOpen)

  useEffect(() => {
    if (!menuFormActive) return
    let cancelled = false
    setMenusLoading(true)
    setMenusLoadError(false)
    void fetchAdminMenus()
      .then((list) => {
        if (!cancelled) setSalonMenus(list)
      })
      .catch(() => {
        if (!cancelled) setMenusLoadError(true)
      })
      .finally(() => {
        if (!cancelled) setMenusLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [menuFormActive])

  /** スタッフフォームではアーカイブ済みメニューを選択肢に出さない */
  const menusForStaffForm = useMemo(
    () => salonMenus.filter((m) => !m.is_archived),
    [salonMenus],
  )

  useEffect(() => {
    if (!menuFormActive || salonMenus.length === 0) return
    setSelectedMenuIds((prev) =>
      prev.filter((id) => {
        const m = salonMenus.find((x) => x.menu_id === id)
        return Boolean(m && !m.is_archived)
      }),
    )
  }, [salonMenus, menuFormActive])

  useEffect(() => {
    if (!formOpen || formOpen === "add" || !("edit" in formOpen)) return
    const id = formOpen.edit.id
    const listRow = formOpen.edit
    let cancelled = false
    void (async () => {
      setTrainerDetailLoading(true)
      setTrainerDetailError("")
      try {
        const detail = await fetchAdminTrainerById(id, listRow)
        if (cancelled) return
        if (!detail) {
          setTrainerDetailError("スタッフ詳細を取得できませんでした。")
          return
        }
        setFormDescription(detail.description ?? "")
        setFormImageUrl(detail.image_url ?? "")
        setFormDisplayOrder(
          detail.display_order !== undefined && detail.display_order !== null
            ? String(detail.display_order)
            : "",
        )
        setSelectedMenuIds(detail.menuIds ? [...detail.menuIds] : [])
      } catch (e) {
        if (cancelled) return
        if (e instanceof Error && e.message === "UNAUTHORIZED") {
          navigate(ROUTES.backofficeLogin, { replace: true })
          return
        }
        /** 一覧行は既にフォームへ入っているため、詳細 GET が失敗しても編集可能にする */
        if (String(listRow.id) === String(id)) {
          setFormDescription(listRow.description ?? "")
          setFormImageUrl(listRow.image_url ?? "")
          setFormDisplayOrder(
            listRow.display_order !== undefined && listRow.display_order !== null
              ? String(listRow.display_order)
              : "",
          )
          setSelectedMenuIds(listRow.menuIds ? [...listRow.menuIds] : [])
          setTrainerDetailError("")
          return
        }
        setTrainerDetailError(
          "スタッフ詳細の取得に失敗しました。再取得してから保存してください。",
        )
      } finally {
        if (!cancelled) setTrainerDetailLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [formOpen, navigate])

  const toggleMenuSelection = (menuId: string) => {
    setSelectedMenuIds((prev) =>
      prev.includes(menuId) ? prev.filter((id) => id !== menuId) : [...prev, menuId],
    )
  }

  const orderedSelectedMenuIds = useMemo(
    () =>
      menusForStaffForm
        .map((m) => m.menu_id)
        .filter((id) => selectedMenuIds.includes(id)),
    [menusForStaffForm, selectedMenuIds],
  )

  const openEdit = (s: Staff) => {
    setFormError("")
    setPageError("")
    setFormName(s.name)
    setFormColor(s.color)
    setFormDescription(s.description ?? "")
    setFormImageUrl(s.image_url ?? "")
    setFormDisplayOrder(
      s.display_order !== undefined && s.display_order !== null
        ? String(s.display_order)
        : "",
    )
    setSelectedMenuIds(s.menuIds ? [...s.menuIds] : [])
    setEditConfirmOpen(false)
    setTrainerDetailLoading(false)
    setTrainerDetailError("")
    setFormOpen({ edit: s })
  }

  const closeForm = () => {
    setFormOpen(null)
    setFormError("")
    setAddConfirmOpen(false)
    setEditConfirmOpen(false)
    setTrainerDetailLoading(false)
    setTrainerDetailError("")
  }

  /** 追加: 入力検証のうえ確認ダイアログへ */
  const requestAddConfirm = () => {
    const name = formName.trim()
    if (!name) {
      setFormError("スタッフ名を入力してください")
      return
    }
    if (name.length > 100) {
      setFormError("スタッフ名は100文字以内で入力してください")
      return
    }
    const color = normalizeHex(formColor)
    if (!/^#[0-9a-f]{6}$/i.test(color)) {
      setFormError("表示色は #RRGGBB 形式で入力してください")
      return
    }
    if (isStaffNameTaken(staffList, formName)) {
      setFormError("すでに登録されている名前です")
      return
    }
    const doRaw = formDisplayOrder.trim()
    if (doRaw) {
      const n = Number(doRaw)
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
        setFormError("表示順序は0以上の整数で入力してください（未入力で省略）")
        return
      }
    }
    setFormError("")
    setAddConfirmOpen(true)
  }

  /** 追加: 確認後に POST /api/admin/trainers */
  const confirmRegisterStaff = () => {
    void (async () => {
      const color = normalizeHex(formColor)
      setFormSaving(true)
      setFormError("")
      try {
        if (isStaffNameTaken(staffList, formName)) {
          setFormError("すでに登録されている名前です")
          setAddConfirmOpen(false)
          return
        }
        const doRaw = formDisplayOrder.trim()
        const displayOrderParsed = doRaw
          ? Math.round(Number(doRaw))
          : undefined
        const created = await addStaff({
          name: formName.trim(),
          color,
          description: formDescription.trim() || undefined,
          image_url: formImageUrl.trim() || undefined,
          display_order: displayOrderParsed,
          menuIds: orderedSelectedMenuIds,
        })
        if (!created) {
          setFormError("登録できませんでした。サーバーの設定を確認してください。")
          return
        }
        setAddConfirmOpen(false)
        closeForm()
      } catch (e) {
        if (e instanceof Error && e.message === "UNAUTHORIZED") {
          navigate(ROUTES.backofficeLogin, { replace: true })
          return
        }
        setFormError("通信に失敗しました")
      } finally {
        setFormSaving(false)
      }
    })()
  }

  /** 編集: 入力検証のうえ確認ダイアログへ */
  const requestEditConfirm = () => {
    if (!formOpen || typeof formOpen !== "object" || !("edit" in formOpen)) return
    const color = normalizeHex(formColor)
    if (!/^#[0-9a-f]{6}$/i.test(color)) {
      setFormError("色は #RRGGBB 形式で入力してください")
      return
    }
    const name = formName.trim()
    if (!name) {
      setFormError("名前を入力してください")
      return
    }
    if (name.length > 100) {
      setFormError("名前は100文字以内で入力してください")
      return
    }
    const doRaw = formDisplayOrder.trim()
    if (doRaw) {
      const n = Number(doRaw)
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
        setFormError("表示順序は0以上の整数で入力してください（未入力で省略）")
        return
      }
    }
    if (isStaffNameTaken(staffList, name, formOpen.edit.id)) {
      setFormError("すでに登録されている名前です")
      return
    }
    if (trainerDetailError) {
      setFormError("スタッフ詳細の取得に失敗しているため、保存できません。")
      return
    }
    setFormError("")
    setEditConfirmOpen(true)
  }

  /** 編集: 確認後に PUT */
  const confirmUpdateStaff = () => {
    void (async () => {
      if (!formOpen || typeof formOpen !== "object" || !("edit" in formOpen)) return
      const color = normalizeHex(formColor)
      const name = formName.trim()
      const doRaw = formDisplayOrder.trim()
      setFormSaving(true)
      setFormError("")
      try {
        if (isStaffNameTaken(staffList, name, formOpen.edit.id)) {
          setFormError("すでに登録されている名前です")
          setEditConfirmOpen(false)
          return
        }
        const displayOrderParsed = doRaw ? Math.round(Number(doRaw)) : undefined
        const ok = await updateStaff(formOpen.edit.id, {
          name,
          color,
          description: formDescription,
          image_url: formImageUrl,
          display_order: displayOrderParsed,
          menuIds: orderedSelectedMenuIds,
        })
        if (!ok) {
          setFormError("保存できませんでした")
          return
        }
        setEditConfirmOpen(false)
        closeForm()
      } catch (e) {
        if (e instanceof Error && e.message === "UNAUTHORIZED") {
          navigate(ROUTES.backofficeLogin, { replace: true })
          return
        }
        setFormError("通信に失敗しました")
      } finally {
        setFormSaving(false)
      }
    })()
  }

  const openDelete = (s: Staff) => {
    setPageError("")
    const others = staffList.filter((x) => x.id !== s.id)
    if (others.length === 0) {
      setPageError("スタッフは少なくとも1名必要です")
      return
    }
    void (async () => {
      setDeletePrecheckLoading(true)
      try {
        const list = await fetchAllReservationsForAdmin(staffList)
        if (countFutureReservationsForTrainer(s.id, list) > 0) {
          setPageError(
            `担当者「${s.name}」は予約が入っているため、削除できません`,
          )
          return
        }
        setDeleteTarget(s)
      } catch (e) {
        if (e instanceof Error && e.message === "UNAUTHORIZED") {
          navigate(ROUTES.backofficeLogin, { replace: true })
          return
        }
        setPageError(
          "予約一覧の取得に失敗しました。しばらくしてから再度お試しください。",
        )
      } finally {
        setDeletePrecheckLoading(false)
      }
    })()
  }

  const confirmDelete = () => {
    void (async () => {
      if (!deleteTarget) return
      setDeleteWorking(true)
      setPageError("")
      try {
        const list = await fetchAllReservationsForAdmin(staffList)
        if (countFutureReservationsForTrainer(deleteTarget.id, list) > 0) {
          setPageError(
            `担当者「${deleteTarget.name}」は予約が入っているため、削除できません`,
          )
          setDeleteTarget(null)
          return
        }
        await deleteStaff(deleteTarget)
        setDeleteTarget(null)
      } catch (e) {
        if (e instanceof Error && e.message === "UNAUTHORIZED") {
          navigate(ROUTES.backofficeLogin, { replace: true })
          return
        }
        setPageError(
          "無効化に失敗しました。ネットワークまたはサーバーを確認してください。",
        )
      } finally {
        setDeleteWorking(false)
      }
    })()
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">読み込み中...</p>
  }

  if (staffLoadError) {
    return (
      <div className="space-y-3 rounded-lg border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          スタッフ一覧の取得に失敗しました。ネットワークまたはサーバーを確認してください。
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => void refetchStaff()}>
          再試行
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          カレンダー・予約の担当表示に使うスタッフを管理します。メニュー一覧は GET
          /api/admin/menus、登録・更新はトレーナー API と連携します。
        </p>
        <Button type="button" size="sm" className="rounded-md" onClick={openAdd}>
          <Plus className="mr-1 size-4" />
          スタッフを追加
        </Button>
      </div>

      {pageError && (
        <p className="text-sm text-destructive" role="alert">
          {pageError}
        </p>
      )}
      {deletePrecheckLoading && (
        <p className="text-sm text-muted-foreground">予約状況を確認しています...</p>
      )}

      <Card className="border-border shadow-xs">
        <CardHeader>
          <CardTitle className="text-lg">スタッフ招待</CardTitle>
          <CardDescription>
            メールアドレス宛に登録URLを送信します。スタッフ本人がリンク先で氏名と
            パスワードを設定します。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="staff-invite-email">メールアドレス</Label>
              <Input
                id="staff-invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => {
                  setInviteEmail(e.target.value)
                  setInviteError("")
                }}
                placeholder="staff@example.com"
              />
            </div>
            <Button
              type="button"
              className="self-end rounded-md"
              disabled={inviteSaving}
              onClick={() => void createInvite()}
            >
              {inviteSaving ? "送信中..." : "招待メールを送信"}
            </Button>
          </div>
          {inviteError ? (
            <p className="text-sm text-destructive" role="alert">
              {inviteError}
            </p>
          ) : null}
          {inviteResult ? (
            <div className="rounded-md border border-border bg-muted/20 p-3 text-sm">
              <p className="font-medium">招待メールを送信しました。</p>
              <p className="mt-1 break-all font-mono text-xs">{inviteResult.signupUrl}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                有効期限: {new Date(inviteResult.expiresAt).toLocaleString("ja-JP")}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border shadow-xs">
        <CardHeader>
          <CardTitle className="text-lg">スタッフ一覧</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[320px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">色</th>
                <th className="pb-2 pr-4 font-medium">名前</th>
                <th className="pb-2 pr-4 font-medium">対応メニュー</th>
                <th className="pb-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {staffList.map((s) => (
                <tr key={s.id} className="border-b border-border/60">
                  <td className="py-3 pr-4">
                    <span
                      className="inline-block size-6 rounded-full border border-border"
                      style={{ backgroundColor: s.color }}
                      title={s.color}
                    />
                  </td>
                  <td className="py-3 pr-4 font-medium">{s.name}</td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {s.menuIds?.length ? `${s.menuIds.length} 件` : "—"}
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-md"
                        onClick={() => openEdit(s)}
                      >
                        <Pencil className="mr-1 size-3.5" />
                        編集
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-md text-destructive hover:bg-destructive/10"
                        disabled={deletePrecheckLoading}
                        onClick={() => openDelete(s)}
                      >
                        <Trash2 className="mr-1 size-3.5" />
                        削除
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {formOpen &&
        !(formOpen === "add" && addConfirmOpen) &&
        !(
          typeof formOpen === "object" &&
          formOpen !== null &&
          "edit" in formOpen &&
          editConfirmOpen
        ) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="staff-form-title"
          onClick={closeForm}
        >
          <Card
            className="w-full max-w-md max-h-[90vh] overflow-y-auto border-border shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <CardTitle id="staff-form-title" className="text-base">
                {formOpen === "add" ? "スタッフを追加" : "スタッフを編集"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="staff-name">スタッフ名</Label>
                <Input
                  id="staff-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="例: 山田"
                  maxLength={100}
                  className="rounded-md"
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">100文字以内（必須）</p>
              </div>
              {menuFormActive && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="staff-description">メモ（description）</Label>
                    <textarea
                      id="staff-description"
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="任意で入力できます"
                      rows={3}
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <p className="text-xs text-muted-foreground">
                      未入力の場合は送りません（NULL）
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="staff-image-url">イメージ画像のURL（image_url）</Label>
                    <Input
                      id="staff-image-url"
                      value={formImageUrl}
                      onChange={(e) => setFormImageUrl(e.target.value)}
                      placeholder="https://..."
                      className="rounded-md"
                      autoComplete="off"
                    />
                    <p className="text-xs text-muted-foreground">未入力の場合は送りません</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="staff-display-order">表示順序（display_order）</Label>
                    <Input
                      id="staff-display-order"
                      type="number"
                      min={0}
                      step={1}
                      value={formDisplayOrder}
                      onChange={(e) => setFormDisplayOrder(e.target.value)}
                      placeholder="未入力でサーバー採番"
                      className="rounded-md max-w-[200px] font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>対応可能なメニュー</Label>
                    <p className="text-xs text-muted-foreground">
                      メニュー管理 API の GET /api/admin/menus から、未アーカイブのメニューを表示して選択します（アーカイブ済みは表示しません）。
                      {formOpen === "add" ? (
                        <>
                          {" "}新規登録では POST /api/admin/trainers を1回だけ実行し、選択した
                          メニューをまとめて送信します。
                        </>
                      ) : (
                        <>
                          {" "}
                          編集では PUT /api/admin/trainers/&#123;trainer_id&#125;
                          に対応メニューをまとめて送信します。
                        </>
                      )}
                    </p>
                    {menusLoading ? (
                      <p className="text-sm text-muted-foreground">メニュー一覧を読み込み中...</p>
                    ) : menusLoadError ? (
                      <p className="text-sm text-destructive" role="alert">
                        メニュー一覧の取得に失敗しました。画面を閉じて再度お試しください。
                      </p>
                    ) : menusForStaffForm.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        登録メニューがありません。メニュー未選択のまま登録すると、対応メニューなしで保存されます。
                      </p>
                    ) : (
                      <ul className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-border p-3">
                        {menusForStaffForm.map((m) => (
                          <li key={m.menu_id} className="flex items-start gap-2 text-sm">
                            <input
                              id={`staff-menu-${m.menu_id}`}
                              type="checkbox"
                              checked={selectedMenuIds.includes(m.menu_id)}
                              onChange={() => toggleMenuSelection(m.menu_id)}
                              className="mt-1 size-4 shrink-0 rounded border border-input"
                            />
                            <label
                              htmlFor={`staff-menu-${m.menu_id}`}
                              className="cursor-pointer leading-snug"
                            >
                              <span className="font-medium">{m.name}</span>
                              {!m.is_public ? (
                                <span className="ml-1.5 text-xs text-amber-700 dark:text-amber-400">
                                  非公開
                                </span>
                              ) : null}
                            </label>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label htmlFor="staff-color">表示色</Label>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    id="staff-color"
                    type="color"
                    value={/^#[0-9A-Fa-f]{6}$/i.test(formColor) ? formColor : "#6366f1"}
                    onChange={(e) => setFormColor(e.target.value)}
                    className="size-10 cursor-pointer rounded border border-border bg-background"
                  />
                  <Input
                    value={formColor}
                    onChange={(e) => setFormColor(e.target.value)}
                    placeholder="#3b82f6"
                    className="max-w-[140px] rounded-md font-mono text-sm"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="size-7 rounded-full border-2 border-transparent ring-offset-2 transition-shadow hover:ring-2 hover:ring-ring"
                      style={{ backgroundColor: c }}
                      title={c}
                      onClick={() => setFormColor(c)}
                    />
                  ))}
                </div>
              </div>
              {formError && (
                <p className="text-sm text-destructive" role="alert">
                  {formError}
                </p>
              )}
              {trainerDetailLoading ? (
                <p className="text-sm text-muted-foreground">スタッフ詳細を読み込み中...</p>
              ) : null}
              {trainerDetailError ? (
                <div className="space-y-2">
                  <p className="text-sm text-destructive" role="alert">
                    {trainerDetailError}
                  </p>
                  {typeof formOpen === "object" && formOpen !== null && "edit" in formOpen ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-md"
                      onClick={() => setFormOpen({ edit: formOpen.edit })}
                    >
                      再取得
                    </Button>
                  ) : null}
                </div>
              ) : null}
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" className="rounded-md" onClick={closeForm}>
                  キャンセル
                </Button>
                {formOpen === "add" ? (
                  <Button
                    type="button"
                    className="rounded-md"
                    disabled={formSaving || menusLoading}
                    onClick={requestAddConfirm}
                  >
                    追加
                  </Button>
                ) : (
                  <Button
                    type="button"
                    className="rounded-md"
                    disabled={
                      formSaving ||
                      menusLoading ||
                      trainerDetailLoading ||
                      Boolean(trainerDetailError)
                    }
                    onClick={requestEditConfirm}
                  >
                    保存
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {typeof formOpen === "object" &&
        formOpen !== null &&
        "edit" in formOpen &&
        editConfirmOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="staff-edit-confirm-title"
          onClick={() => setEditConfirmOpen(false)}
        >
          <Card
            className="w-full max-w-md border-border shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <CardTitle id="staff-edit-confirm-title" className="text-base">
                保存の確認
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-foreground">
                この内容でスタッフ情報を更新しますか？
              </p>
              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                <p>
                  <span className="text-muted-foreground">スタッフ名: </span>
                  <span className="font-medium">{formName.trim()}</span>
                </p>
                <p className="mt-2 flex items-center gap-2">
                  <span className="text-muted-foreground">表示色: </span>
                  <span
                    className="inline-block size-4 rounded-full border border-border"
                    style={{ backgroundColor: normalizeHex(formColor) }}
                  />
                  <span className="font-mono text-xs">{normalizeHex(formColor)}</span>
                </p>
                {formDescription.trim() ? (
                  <p className="mt-2 whitespace-pre-wrap">
                    <span className="text-muted-foreground">メモ: </span>
                    {formDescription.trim()}
                  </p>
                ) : (
                  <p className="mt-2 text-muted-foreground">メモ: （未入力）</p>
                )}
                {formImageUrl.trim() ? (
                  <p className="mt-2 break-all text-xs">
                    <span className="text-muted-foreground">画像URL: </span>
                    {formImageUrl.trim()}
                  </p>
                ) : (
                  <p className="mt-2 text-muted-foreground">画像URL: （未入力）</p>
                )}
                {formDisplayOrder.trim() ? (
                  <p className="mt-2 font-mono text-xs">
                    <span className="text-muted-foreground">表示順序: </span>
                    {formDisplayOrder.trim()}
                  </p>
                ) : (
                  <p className="mt-2 text-muted-foreground">表示順序: （未入力・サーバー採番）</p>
                )}
                <p className="mt-2 text-sm">
                  <span className="text-muted-foreground">対応メニュー: </span>
                  {orderedSelectedMenuIds.length === 0 ? <span>なし</span> : null}
                </p>
                {orderedSelectedMenuIds.length > 0 && (
                  <ul className="mt-1 list-inside list-disc text-sm text-foreground">
                    {orderedSelectedMenuIds.map((id) => {
                      const label =
                        salonMenus.find((m) => m.menu_id === id)?.name ?? "（名称不明）"
                      return (
                        <li key={id}>
                          {label}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
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
                  onClick={() => setEditConfirmOpen(false)}
                >
                  いいえ
                </Button>
                <Button
                  type="button"
                  className="rounded-md"
                  disabled={formSaving}
                  onClick={confirmUpdateStaff}
                >
                  {formSaving ? "保存中..." : "はい"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {formOpen === "add" && addConfirmOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="staff-add-confirm-title"
          onClick={() => setAddConfirmOpen(false)}
        >
          <Card
            className="w-full max-w-md border-border shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <CardTitle id="staff-add-confirm-title" className="text-base">
                登録の確認
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-foreground">
                この内容でスタッフを登録しますか？
              </p>
              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                <p>
                  <span className="text-muted-foreground">スタッフ名: </span>
                  <span className="font-medium">{formName.trim()}</span>
                </p>
                <p className="mt-2 flex items-center gap-2">
                  <span className="text-muted-foreground">表示色: </span>
                  <span
                    className="inline-block size-4 rounded-full border border-border"
                    style={{ backgroundColor: normalizeHex(formColor) }}
                  />
                  <span className="font-mono text-xs">{normalizeHex(formColor)}</span>
                </p>
                {formDescription.trim() ? (
                  <p className="mt-2 whitespace-pre-wrap">
                    <span className="text-muted-foreground">メモ: </span>
                    {formDescription.trim()}
                  </p>
                ) : (
                  <p className="mt-2 text-muted-foreground">メモ: （未入力）</p>
                )}
                {formImageUrl.trim() ? (
                  <p className="mt-2 break-all text-xs">
                    <span className="text-muted-foreground">画像URL: </span>
                    {formImageUrl.trim()}
                  </p>
                ) : (
                  <p className="mt-2 text-muted-foreground">画像URL: （未入力）</p>
                )}
                {formDisplayOrder.trim() ? (
                  <p className="mt-2 font-mono text-xs">
                    <span className="text-muted-foreground">表示順序: </span>
                    {formDisplayOrder.trim()}
                  </p>
                ) : (
                  <p className="mt-2 text-muted-foreground">表示順序: （未入力・サーバー採番）</p>
                )}
                <p className="mt-2 text-sm">
                  <span className="text-muted-foreground">対応メニュー: </span>
                  {orderedSelectedMenuIds.length === 0 ? <span>なし</span> : null}
                </p>
                {orderedSelectedMenuIds.length > 0 && (
                  <ul className="mt-1 list-inside list-disc text-sm text-foreground">
                    {orderedSelectedMenuIds.map((id) => {
                      const label =
                        salonMenus.find((m) => m.menu_id === id)?.name ?? "（名称不明）"
                      return (
                        <li key={id}>
                          {label}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
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
                  onClick={confirmRegisterStaff}
                >
                  {formSaving ? "登録中..." : "登録"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="staff-delete-title"
          onClick={() => setDeleteTarget(null)}
        >
          <Card
            className="w-full max-w-md border-border shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <CardTitle id="staff-delete-title" className="text-base">
                削除の確認
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-foreground">
                本当に<strong className="font-semibold">「{deleteTarget.name}」</strong>
                を削除しますか？
              </p>
              <p className="text-xs text-muted-foreground">
                実行すると無効化（is_active=false）となり、過去の予約データは保持されます。
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-md"
                  disabled={deleteWorking}
                  onClick={() => setDeleteTarget(null)}
                >
                  キャンセル
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="rounded-md"
                  disabled={deleteWorking}
                  onClick={confirmDelete}
                >
                  {deleteWorking ? "削除中..." : "削除"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
