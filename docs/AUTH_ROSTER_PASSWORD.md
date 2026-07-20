# 登入：預核名單 + 驗證碼設密碼 + 帳密登入

## 流程（老師／學生相同）

1. 管理員把帳號寫進 `auth/data/roster.json`（role: `admin` | `teacher` | `student`）
2. 使用者第一次：**寄驗證碼 → 設定密碼 → 自動登入**
3. 之後：**Email + 密碼**（不必每次驗證信箱）
4. 忘記密碼：再走驗證碼重設

未在名單 → 無法寄碼、無法登入（**不是**靠網域白名單）。

## 測試帳（見 roster.example.json）

| Email | 角色 |
|-------|------|
| kainnne@kcis.com.tw | admin |
| demo.teacher@example.com | teacher |
| demo.student@example.com | student |

未設 SMTP 時，驗證碼印在跑 `npm run auth` 的終端機。

## 可移植

- 設定：`auth/.env`
- 名單：`auth/data/roster.json`（可之後改接 Google Workspace / CSV）
- 使用者密碼雜湊：`auth/data/users.json`
- 換電腦：複製 repo + `.env` + roster；或只同步 roster

## LLM

`LLM_PROVIDER=codex`（預設）。之後改 `openai` / 自架時擴充 `auth/lib/llm.js` 即可，前端 Codex 頁不用改。

多學生同時用：Auth／session 可並發；**本機 Codex CLI 是瓶頸**，正式環境請換可水平擴展的 provider。
