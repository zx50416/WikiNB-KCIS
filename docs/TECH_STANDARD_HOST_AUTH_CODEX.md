# 技術守則：部署主機 × Auth × Codex CLI

> **文件定位：** WikiNB for KCIS 的正式架構與維運守則（後續 Agent／維護者必讀）  
> **適用功能：** 線上站登入、驗證碼寄信、連線主機 Codex CLI  
> **配套操作手冊：** [HOST_DEPLOY.md](./HOST_DEPLOY.md)（逐步指令）  
> **更新日期：** 2026-07-20

---

## 1. 為什麼要有這份守則

職員必須能：

1. 打開固定網址瀏覽筆記  
2. 用 Email／驗證碼／密碼登入  
3. 使用 Codex（實際在「部署主機」上的 CLI）

**禁止**要求一般職員在自己的電腦執行 `npm run auth` 或 `npm run dev`。  
那僅限開發者本機除錯。

---

## 2. 目標架構（不可擅自改成單機混用）

```text
┌─────────────────────────────┐
│  職員瀏覽器                 │
└─────────────┬───────────────┘
              │
      ┌───────┴────────┐
      ▼                ▼
 GitHub Pages      HTTPS Tunnel
 （靜態 UI／wiki）   （對外 Auth）
 https://zx50416.github.io/WikiNB-KCIS/
      │                │
      │                ▼
      │         部署主機 :8788
      │         ├─ auth/（Express）
      │         │   · roster 預核
      │         │   · 驗證碼／密碼
      │         │   · SMTP 代寄
      │         └─ Codex CLI（LLM_PROVIDER=codex）
      │
      └── 筆記內容來自 repo 的 wiki/（build 進 Pages）
```

| 層 | 職責 | 誰維護 |
|----|------|--------|
| **Pages** | HTML／CSS／搜尋／登入頁 UI | git push → Actions |
| **Tunnel** | 把主機 8788 變成 HTTPS | 主機上的 cloudflared |
| **Auth API** | 登入、session、寄信 | 主機 `npm run auth` |
| **Codex CLI** | 實際推論 | **與 Auth 同一台主機** |

### 主機時程

| 階段 | 部署主機 | Codex CLI 位置 |
|------|----------|----------------|
| 現在 | Mac | 該 Mac |
| 未來 | Windows 桌機 | 該 Windows |

搬遷時：**搬整個 repo + `auth/.env` + Tunnel 設定**；Pages 網址不變。

---

## 3. 硬性規則（違反即視為架構錯誤）

### 3.1 網址與協定

1. **線上前端**必須是 HTTPS（GitHub Pages）。  
2. **線上 Auth**必須是 HTTPS（Tunnel 或等同方案）。  
3. **禁止**讓 `https://*.github.io` 直接呼叫 `http://127.0.0.1:8788`  
   （瀏覽器會擋 mixed content；職員會看到「未連線」。）  
4. `config/sites.json`：
   - `auth.url` → 僅本機開發（`http://127.0.0.1:8788`）  
   - `auth.productionUrl` → **主機 Auth 的 HTTPS 根網址**（無尾隨 `/`）  
5. 前端選路邏輯（`src/scripts/auth-client.js`）：
   - hostname 為 `*.github.io` → 使用 `productionUrl`  
   - `127.0.0.1`／`localhost` → 使用 `url`  

### 3.2 密鑰與資料

| 可進 git | **不可**進 git |
|----------|----------------|
| 程式、wiki 筆記、`roster.json`（知悉名單會公開於 public repo） | `auth/.env` |
| `auth/.env.example`、`host/*` 腳本 | `auth/data/users.json`（密碼雜湊） |
| 本守則與 HOST_DEPLOY | SMTP 應用程式密碼、`SESSION_SECRET` |

### 3.3 Cookie／CORS（主機模式）

當 Pages 打 Tunnel Auth 時，主機 `auth/.env` 必須：

```env
AUTH_BASE_URL=https://＜與 productionUrl 相同＞
FRONTEND_ORIGINS=https://zx50416.github.io
COOKIE_SAMESITE=none
```

- `AUTH_BASE_URL` 為 `https` 時，session cookie 自動 `SameSite=None; Secure`。  
- **本機** `npm run dev` 除錯時：不要開著 `COOKIE_SAMESITE=none` 卻把 `AUTH_BASE_URL` 留在 `http://127.0.0.1`（會導致 Secure cookie 無法寫入 HTTP 本機站）。  
  → 開發用本機 Auth：註解掉 `COOKIE_SAMESITE`／保持 `AUTH_BASE_URL=http://127.0.0.1:8788`。  
  → 正式主機＋Tunnel：兩者都設 HTTPS／none。

### 3.4 Codex

1. `LLM_PROVIDER=codex` 時，CLI **必須安裝在跑 Auth 的同一台主機**。  
2. 換 Windows 主機＝換 Codex 執行環境；不要假設 Mac CLI 還會被呼叫。  
3. 多使用者並發時，本機 Codex CLI 是瓶頸；日後可換雲端 LLM，但 **adapter 介面留在 `auth/lib/llm.js`**，前端 Codex 頁不應綁死單一 vendor UI 以外的協定。

### 3.5 登入產品行為（勿回退）

1. 先只填 Email → 預核名單檢查。  
2. 未設密碼 → 自動寄碼 → **先驗證碼正確** → 再顯示新密碼／確認。  
3. 已設密碼 → 密碼登入；忘記密碼走驗證碼。  
4. 角色來自 **roster**，不可只靠 Email 網域判斷老師／學生。

---

## 4. 標準目錄與腳本

```text
WikiNB_for_KCIS/
├── auth/                  # 主機上常駐的 API
│   ├── .env               # 密鑰（gitignore）
│   ├── server.js
│   └── lib/llm.js         # Codex／可換 provider
├── host/
│   ├── one-command-mac.sh # 【交接首選】一鍵 Auth+Tunnel+寫入網址
│   ├── stop-mac.sh
│   ├── start-mac.sh
│   ├── tunnel-mac.sh
│   ├── start-windows.ps1
│   └── tunnel-windows.ps1
├── config/sites.json      # productionUrl 單一真相（進 git）
├── src/scripts/auth-client.js
└── docs/
    ├── TECH_STANDARD_HOST_AUTH_CODEX.md  ← 本守則
    └── HOST_DEPLOY.md                    ← 操作步驟
```

npm 捷徑：

- `npm run host:mac` → `host/start-mac.sh`  
- `npm run host:tunnel` → `host/tunnel-mac.sh`  
- `npm run auth` → 僅 Auth（開發）  
- `npm run dev` → 僅前端（開發）

---

## 5. 變更流程（守則）

### 5.1 只改筆記／UI

`git push` → Pages 自動建置即可。主機 Auth 通常不用重啟。

### 5.2 變更 Auth／Codex 程式

1. 主機 pull 最新碼  
2. 重啟 `host/start-*.`  
3. Tunnel 若仍在跑可不動  

### 5.3 變更 Tunnel 網址（Quick Tunnel 會變）

1. 更新 `config/sites.json` → `auth.productionUrl`  
2. 更新主機 `auth/.env` → `AUTH_BASE_URL`（必須一致）  
3. 重啟 Auth  
4. **commit + push**（否則線上站仍指向舊 Auth）  

正式環境應改用 **Named Tunnel（固定網域）**，避免每次改 `productionUrl`。

### 5.4 搬到 Windows

1. 安裝 Node LTS、Codex CLI、cloudflared  
2. clone／複製專案 + 還原 `auth/.env`  
3. `npm install`、`npm run auth:install`  
4. `.\host\start-windows.ps1` + `.\host\tunnel-windows.ps1`  
5. 若 Tunnel URL 變了 → 走 §5.3  
6. 停止舊 Mac 上的 Auth／Tunnel，避免兩台搶同一邏輯（可並存測試但勿混用同一 productionUrl）

---

## 6. 驗收標準（Definition of Done）

職員情境（主機開著 Auth＋Tunnel、`productionUrl` 已上線）：

| # | 檢查 | 通過條件 |
|---|------|----------|
| 1 | 開啟 Pages 首頁 | 可瀏覽筆記，無需登入 |
| 2 | `/login` | **無**「只能本機 HTTP」類錯誤；可打到主機 health |
| 3 | 預核 Email | 未在 roster → 明確拒絕文案 |
| 4 | 首次帳號 | 收到驗證碼（SMTP 或主機終端機 DEV）→ 設密碼成功 |
| 5 | 再次登入 | Email → 密碼即可 |
| 6 | `/codex` | 登入後可對話；請求落在**當前主機** CLI |

開發者本機（不經 Pages）：

| # | 檢查 | 通過條件 |
|---|------|----------|
| A | `npm run auth` + `npm run dev` | `http://127.0.0.1:4321/WikiNB-KCIS/login` 可登入 |

---

## 7. 明確非目標（本階段不做）

- 要求職員安裝 Node／自己開 Auth  
- 把 Codex CLI 放在與 Auth 不同的機器卻不改 adapter  
- 僅靠 Email 網域開放註冊  
- 將 `auth/.env` 或應用程式密碼寫進 repo／聊天紀錄  
- 用 HTTP 公網 IP 當正式 Auth（必須 HTTPS）

---

## 8. Agent／維護者檢查清單

改動登入、部署、Codex 相關程式前，確認：

- [ ] 是否仍維持「Pages UI ↔ HTTPS Auth ↔ 主機 Codex」三層？  
- [ ] `productionUrl` 與 `AUTH_BASE_URL` 是否一致且為 HTTPS？  
- [ ] 本機開發路徑是否仍可用 `auth.url`？  
- [ ] Cookie／CORS 是否依 §3.3？  
- [ ] 文件是否同步（本守則＋HOST_DEPLOY＋README）？  
- [ ] 密鑰是否仍被 gitignore？

---

## 9. 相關文件索引

| 文件 | 用途 |
|------|------|
| **本文件** | 架構與技術守則（規範） |
| [HOST_DEPLOY.md](./HOST_DEPLOY.md) | Mac／Windows 逐步操作 |
| [AUTH_ROSTER_PASSWORD.md](./AUTH_ROSTER_PASSWORD.md) | 登入產品流程 |
| [SECURITY_AND_ONBOARDING.md](./SECURITY_AND_ONBOARDING.md) | 開通帳號與資安 |
| [DEPLOY_PRIVATE_PAGES.md](./DEPLOY_PRIVATE_PAGES.md) | Pages／repo 公開說明 |
| [REQUIREMENTS_AND_TECH.md](./REQUIREMENTS_AND_TECH.md) | 整體需求 |

---

**一句話：**  
筆記在 Pages；帳號與 AI 在「部署主機」；中間必須是 HTTPS Tunnel。現在主機是 Mac，未來換成 Windows 時只換主機，不換職員網址與這套規則。
