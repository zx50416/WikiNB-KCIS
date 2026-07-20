# WikiNB for KCIS

康橋國際學校教學筆記知識庫。

**線上網站：** https://zx50416.github.io/WikiNB-KCIS/  
**原始碼：** https://github.com/zx50416/WikiNB-KCIS  

**需求：** [docs/REQUIREMENTS_AND_TECH.md](./docs/REQUIREMENTS_AND_TECH.md)  
**登入：** [docs/AUTH_ROSTER_PASSWORD.md](./docs/AUTH_ROSTER_PASSWORD.md)  
**部署／本機 Auth：** [docs/DEPLOY_PRIVATE_PAGES.md](./docs/DEPLOY_PRIVATE_PAGES.md)  
**資安 × 加人：** [docs/SECURITY_AND_ONBOARDING.md](./docs/SECURITY_AND_ONBOARDING.md)

## 怎麼用

| 用途 | 網址／指令 |
|------|------------|
| 瀏覽／搜尋筆記 | https://zx50416.github.io/WikiNB-KCIS/ |
| 登入、寄驗證碼、Codex | 本機 `npm run auth` **＋** `npm run dev` → http://127.0.0.1:4321/WikiNB-KCIS/ |

> **重要：** 線上站是 HTTPS，瀏覽器會擋對本機 `http://127.0.0.1:8788` 的連線。  
> 所以在 github.io 上看筆記可以；**登入／Codex 請用本機網站**（與個人 WikiNB 相同）。

## 本機預覽（登入／Codex）

開兩個終端機：

```bash
# 1) API（登入 + Codex）
npm run auth:install   # 首次
npm run auth

# 2) 網站
npm install            # 首次
npm run dev
```

- 本機網站：http://127.0.0.1:4321/WikiNB-KCIS/  
- Auth API：http://127.0.0.1:8788  
- 登入：`/login` · Codex：`/codex`

測試帳見 `auth/data/roster.json`。未設 SMTP 時，驗證碼印在 `npm run auth` 終端機。

## 資料夾

| 路徑 | 用途 |
|------|------|
| `wiki/teachers/` | 各老師／科目筆記 |
| `auth/` | 登入 API + LLM adapter（預設 Codex） |
| `src/` | 網站程式 |
| `docs/` | 需求、結構、部署 |
| `public/brand/` | 康橋 logo |
| `config/` | 站台設定 |

## 目前狀態

- 瀏覽／搜尋／老師列表、介面中英切換、數學 KaTeX
- 預核名單登入（Email → 驗證碼 → 設密碼 → 之後帳密）
- Codex 頁（Iansui；可換 `LLM_PROVIDER`）
- GitHub Pages 已上線（public repo）

## 建置

```bash
npm run build
```
