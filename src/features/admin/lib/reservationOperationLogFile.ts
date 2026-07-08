import { ADMIN_CALENDAR_TIME_ZONE, getIsoDateKeyInTimeZone } from "@/features/admin/lib/calendarUtils"

const ENDPOINT = "/__log/reservation-operations"

export type ReservationOperationLogEntry = {
  reservationId: string
  /** ISO 8601 */
  timestamp: string
  actor: string
  action: "status_changed" | "memo_updated" | "assignee_changed" | "schedule_changed"
  message: string
}

function formatLogLine(entry: ReservationOperationLogEntry): string {
  const safeMessage = entry.message.replace(/\r?\n/g, " ").replace(/\t/g, " ")
  return `${entry.timestamp}\t${entry.reservationId}\t${entry.actor}\t${entry.action}\t${safeMessage}\n`
}

/**
 * 予約操作ログを「1暦日＝1ファイル」として、
 * **必ず `ReservationApp-frontend/log/` 配下** にのみ追記する。
 *
 * - ファイル名: `reservation-operations-YYYY-MM-DD.log`
 *   - 日付は `ADMIN_CALENDAR_TIME_ZONE`（JST）の暦日
 *   - 同じ日付は既存ファイルに追記（上書きではなく末尾追記）
 * - 仕組み: `vite.config.ts` の `reservationLogFileWriterPlugin` が
 *   `POST /__log/reservation-operations` を受け、書き込み先を `log/` 直下に固定する
 * - 本番ビルド（プラグイン未稼働）や通信失敗時は、書き込みをスキップし `console.warn` のみ。
 *   OPFS / localStorage / ダウンロード等の代替先には**絶対に書かない**。
 */
export async function appendReservationOperationLogFile(
  entry: ReservationOperationLogEntry,
): Promise<void> {
  const dateKey = getIsoDateKeyInTimeZone(entry.timestamp, ADMIN_CALENDAR_TIME_ZONE)
  const fileName = `reservation-operations-${dateKey}.log`
  const line = formatLogLine(entry)

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName, line }),
    })
    if (!res.ok) {
      console.warn(
        `[reservation-operation-log] write failed (status=${res.status}). entry=`,
        entry,
      )
    }
  } catch (e) {
    console.warn(
      "[reservation-operation-log] write skipped (endpoint unavailable).",
      e,
      "entry=",
      entry,
    )
  }
}
