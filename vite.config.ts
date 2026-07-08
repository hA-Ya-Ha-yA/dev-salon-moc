import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import fs from "fs"
import path from "path"
import { defineConfig, loadEnv, type Plugin } from "vite"

/**
 * 予約操作ログ書き込み専用の dev サーバ用ミドルウェア。
 *
 * 書き込み先は **必ず `ReservationApp-frontend/log/` 直下** に固定し、
 * リクエスト側でディレクトリトラバーサル等が指定されてもそれ以外の場所には絶対に書かない。
 */
function reservationLogFileWriterPlugin(): Plugin {
  const LOG_DIR = path.resolve(__dirname, "log")
  const FILE_NAME_RE = /^reservation-operations-\d{4}-\d{2}-\d{2}\.log$/

  return {
    name: "reservation-log-file-writer",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__log/reservation-operations", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405
          res.setHeader("Allow", "POST")
          res.end()
          return
        }
        const chunks: Buffer[] = []
        req.on("data", (c: Buffer) => chunks.push(c))
        req.on("end", () => {
          try {
            const body = Buffer.concat(chunks).toString("utf-8")
            const data = JSON.parse(body) as { fileName?: unknown; line?: unknown }
            const fileName = typeof data.fileName === "string" ? data.fileName : ""
            const line = typeof data.line === "string" ? data.line : ""
            if (!FILE_NAME_RE.test(fileName)) {
              res.statusCode = 400
              res.end("invalid fileName")
              return
            }
            if (!line) {
              res.statusCode = 400
              res.end("empty line")
              return
            }
            // path.basename + LOG_DIR との二重ガードでトラバーサル回避
            const safe = path.basename(fileName)
            const fullPath = path.resolve(LOG_DIR, safe)
            if (!fullPath.startsWith(LOG_DIR + path.sep)) {
              res.statusCode = 400
              res.end("path outside log directory")
              return
            }
            fs.mkdirSync(LOG_DIR, { recursive: true })
            fs.appendFileSync(fullPath, line)
            res.statusCode = 204
            res.end()
          } catch (e) {
            res.statusCode = 500
            res.end((e as Error).message)
          }
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  const apiProxyTarget = env.VITE_DEV_PROXY_TARGET || "http://127.0.0.1:8000"
  const apiProxy = {
    "/api": {
      target: apiProxyTarget,
      changeOrigin: true,
    },
    "/uploads": {
      target: apiProxyTarget,
      changeOrigin: true,
    },
  } as const

  return {
    plugins: [react(), tailwindcss(), reservationLogFileWriterPlugin()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      proxy: { ...apiProxy },
    },
    preview: {
      proxy: { ...apiProxy },
    },
  }
})
