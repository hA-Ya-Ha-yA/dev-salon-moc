import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { installFrontendMock } from './mocks/install'

// フロントエンドのみで完結するモック API を有効化する。
// すべての `/api/*` 呼び出しは `window.fetch` を差し替えて in-memory + localStorage で応答する。
installFrontendMock()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
