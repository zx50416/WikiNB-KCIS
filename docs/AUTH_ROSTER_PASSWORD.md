# 登入：預核名單 + 驗證碼設密碼 + 帳密登入

## 線上／本機

| | 網址 |
|--|------|
| 線上瀏覽 | https://zx50416.github.io/WikiNB-KCIS/ |
| 本機登入／Codex | http://127.0.0.1:4321/WikiNB-KCIS/login（需 `npm run auth` + `npm run dev`） |

線上站無法直接連本機 Auth（瀏覽器 HTTPS→HTTP 限制），詳見 [DEPLOY_PRIVATE_PAGES.md](./DEPLOY_PRIVATE_PAGES.md)。

## 流程（老師／學生相同）

1. 管理員把帳號寫進 `auth/data/roster.json`（role: `admin` | `teacher` | `student`）
2. 使用者第一次：只填 Email → 自動寄驗證碼 → 確認驗證碼 → 新密碼／確認 → 登入
3. 之後：Email → 輸入密碼
4. 忘記密碼：在密碼步驟按「忘記密碼」→ 再走驗證碼

未在名單 → 無法寄碼、無法登入（**不是**靠網域白名單）。

## 測試帳（見 roster.json）

| Email | 角色 | 備註 |
|-------|------|------|
| chaos60649@gmail.com | admin | 主要測試帳；SMTP 寄信帳號；目前唯一 `@gmail.com` |
| kainnne@kcis.com.tw | admin | 康橋信箱預留 |
| demo.teacher@example.com | teacher | 示範 |
| demo.student@example.com | student | 示範 |

驗證碼由 `chaos60649@gmail.com` 經 SMTP 寄出（`auth/.env` 的 `SMTP_USER`）。  
`DEV_LOG_CODE=false` 時不會印在終端機；未填 `SMTP_PASS` 則無法寄信。

## 可移植

- 設定：`auth/.env`
- 名單：`auth/data/roster.json`
- 使用者密碼雜湊：`auth/data/users.json`
- 換電腦：複製 repo + `.env` + roster

## LLM

`LLM_PROVIDER=codex`（預設）。之後改 `openai` / 自架時擴充 `auth/lib/llm.js` 即可。
