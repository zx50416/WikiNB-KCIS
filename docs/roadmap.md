# 實作路線圖

## 已完成

- [x] 需求與技術文件、`wiki/teachers/` 示範筆記
- [x] Astro 網站（康橋配色、i18n、KaTeX）
- [x] 預核名單登入（Email → 驗證碼 → 設密碼 → 帳密）
- [x] Codex 頁（對齊 WikiNB 文案／Markdown／Iansui）
- [x] Public repo + GitHub Pages：https://zx50416.github.io/WikiNB-KCIS/
- [x] 測試帳 `kainnne@kcis.com.tw`（roster admin）

## 進行中

- [ ] 本機設 SMTP（kainnne 應用程式密碼）後測真寄信
- [ ] 本機 `npm run auth` + `npm run dev` 測登入與 Codex

## 下一步

1. 老師／學生角色權限接到上傳與編輯
2. 線上表單編輯器 → MD
3. Chat API + 可換 LLM 主機
4. Auth 若需「線上也能登入」→ 另架 HTTPS Auth（雲端／校內）

## 本階段刻意還不做

- 校外開放註冊
- 正式資料庫（先用 `auth/data/users.json`）
