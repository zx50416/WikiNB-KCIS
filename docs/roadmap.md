# 實作路線圖

## 已完成

- [x] 需求與技術文件
- [x] `wiki/teachers/{teacher}/{subject}/` 與示範筆記
- [x] Astro 初版網站（康橋配色、i18n 介面）
- [x] 登入架構文件與 `auth/` Google OAuth 骨架（僅 @kcis.com.tw）
- [x] 登入頁 `/login`

## 進行中

- [x] 測試帳 `kainnne@kcis.com.tw` 已列入 roster（admin）— 見 `docs/SECURITY_AND_ONBOARDING.md` 自行設密碼
- [x] 登入 UX：先只填 Email → 自動偵測首次設密／輸入密碼／忘記密碼
- [ ] 本機 `npm run auth` + 設完密碼後測 Codex

## 下一步

1. 老師／學生角色權限接到上傳與編輯
2. 線上表單編輯器 → MD
3. Chat API + 可換 LLM 主機
4. 正式部署（前端 Pages + Auth 雲端）

## 本階段刻意還不做

- 校外開放註冊
- 自建帳密（改走 Google）
- 正式資料庫（先用 `auth/data/users.json`，介面已可替換）
