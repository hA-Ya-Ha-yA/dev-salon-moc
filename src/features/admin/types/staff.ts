export interface Staff {
  id: string
  name: string
  /** カレンダー表示用の色（hex） */
  color: string
  /** メモ（API `description`、任意） */
  description?: string
  image_url?: string
  display_order?: number
  /** 対応可能メニュー（GET 一覧や GET 詳細の `menu_ids` 等から） */
  menuIds?: string[]
  /**
   * `trainers.admin_id` — 紐付く `admin_users.admin_id`。
   * シフト編集権限（staff 自分のシフトのみ編集可）の判定に使用。
   */
  adminId?: string | null
}
