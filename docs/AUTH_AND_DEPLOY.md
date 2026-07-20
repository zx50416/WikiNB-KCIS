# 登入架構與可移植部署

## 目標

- Google 登入，**僅允許** `@{ALLOWED_EMAIL_DOMAIN}`（預設 `kcis.com.tw`）
- 設定全放環境變數 → 換電腦／換主機只要複製 `.env`（或密鑰管理）即可
- 靜態前端（Astro）與 Auth API 分離，方便之後前端上 Pages、API 上 Cloud Run／校內機

## 資料夾結構（本階段）

```text
WikiNB for KCIS/
├── auth/                      # 可獨立部署的登入／session 服務
│   ├── .env.example           # 範本（可進 git）
│   ├── .env                   # 密鑰（不可進 git）
│   ├── package.json
│   ├── server.js              # Express：Google OAuth + session
│   ├── lib/
│   │   ├── domain.js          # 網域白名單
│   │   ├── users.js           # 本機使用者庫（JSON，可之後換 DB）
│   │   └── session.js         # JWT cookie
│   └── data/
│       └── users.json         # 執行後產生（gitignore）
├── config/
│   └── sites.json             # 前端知道 auth URL
├── docs/
│   ├── AUTH_GOOGLE_SETUP.md   # 你要跟著做的 Google 步驟
│   └── AUTH_AND_DEPLOY.md     # 本文件
├── src/pages/login.astro
└── src/scripts/auth-client.js
```

## 角色（登入後）

| role | 誰 | 初版行為 |
|------|-----|----------|
| `admin` | `BOOTSTRAP_ADMIN_EMAIL` 首次登入（預設 kainnne@…） | 之後可管老師／審核 |
| `teacher` | 之後由 admin 指定 | 可寫自己的 wiki 資料夾 |
| `student` | 其他 `@kcis.com.tw` 首次登入 | 唯讀＋之後 Chat／CLI |

「註冊」= **第一次用康橋 Google 帳號成功登入**並寫入 `users.json`；非該網域直接拒絕，等於禁止校外註冊。

## 移植到另一台電腦

1. `git clone` 專案
2. `cp auth/.env.example auth/.env` 並填入同一組（或新機器專用）Google 憑證
3. 若網址／埠號不同：同步改 Google Console 的「重新導向 URI」與 `.env` 的 `AUTH_BASE_URL`、`FRONTEND_ORIGIN`
4. `npm install && npm run auth:install`
5. `npm run auth` + `npm run dev`

正式環境建議：

| 元件 | 建議 |
|------|------|
| 前端 | Cloudflare Pages / Vercel / GitHub Pages |
| Auth API | Fly.io / Railway / Cloud Run / 校內 VM |
| 使用者庫 | 之後由 JSON 換成 SQLite／Postgres（介面已隔離在 `lib/users.js`） |

## 本機埠號（預設）

| 服務 | 埠 |
|------|-----|
| Astro 網站 | `4321` |
| Auth API | `8788` |

與個人 WikiNB Bridge（8787）錯開，同一台 Mac 可並存。
