# 實作路線圖

## 已完成

- [x] 需求與技術文件、`wiki/teachers/` 示範筆記
- [x] Astro 網站（康橋配色、i18n、KaTeX）
- [x] 預核名單登入（Email → 驗證碼 → 設密碼 → 帳密）
- [x] Codex 頁（對齊 WikiNB 文案／Markdown／Iansui）
- [x] Public repo + GitHub Pages：https://zx50416.github.io/WikiNB-KCIS/
- [x] 測試帳 `chaos60649@gmail.com`（roster admin + SMTP 寄信）

## 進行中

- [ ] Mac 當部署主機：cloudflared Tunnel + `productionUrl`（見 docs/HOST_DEPLOY.md）
- [ ] 本機設 SMTP 後測真寄信
- [ ] github.io 經 Tunnel 登入並連 Mac Codex

## 下一步

1. 穩定 Named Tunnel（固定 Auth HTTPS）
2. 整份搬到 Windows 桌機（`host/start-windows.ps1`）連該機 Codex
3. 老師／學生權限、編輯器、可擴展 LLM

## 本階段刻意還不做

- 校外開放註冊
- 正式資料庫（先用 `auth/data/users.json`）
