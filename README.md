# WikiNB for KCIS

康橋國際學校教學筆記知識庫（初版）。

**完整需求與技術設計：** [docs/REQUIREMENTS_AND_TECH.md](./docs/REQUIREMENTS_AND_TECH.md)  
**登入（預核名單＋密碼）：** [docs/AUTH_ROSTER_PASSWORD.md](./docs/AUTH_ROSTER_PASSWORD.md)  
**資安 × 加人方式：** [docs/SECURITY_AND_ONBOARDING.md](./docs/SECURITY_AND_ONBOARDING.md)

## 本機預覽

開兩個終端機：

```bash
# 1) API（登入 + Codex adapter）
npm run auth:install   # 首次
npm run auth

# 2) 網站
npm install            # 首次
npm run dev
```

網站：http://127.0.0.1:4321/WikiNB-KCIS/  
登入：`/login` · Codex：`/codex`

測試帳見 `auth/data/roster.example.json`。未設 SMTP 時，驗證碼印在 `npm run auth` 終端機。

## 資料夾

| 路徑 | 用途 |
|------|------|
| `wiki/teachers/` | 各老師／科目筆記 |
| `auth/` | 登入 API + LLM adapter（預設 Codex） |
| `src/` | 網站程式 |
| `docs/` | 需求、結構、路線圖 |
| `public/brand/` | 康橋 logo |
| `config/` | 站台設定 |

## 目前狀態

- 瀏覽／搜尋／老師列表、介面中英切換、數學 KaTeX
- 預核名單登入（驗證碼設密碼 → 之後帳密）
- Codex 頁（Iansui 字體，可換 `LLM_PROVIDER`）

## 建置

```bash
npm run build
```
