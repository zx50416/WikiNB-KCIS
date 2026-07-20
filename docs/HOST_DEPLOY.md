# 部署主機：Auth + Codex（Mac 現在 → Windows 未來）

> **規範（技術守則）：** [TECH_STANDARD_HOST_AUTH_CODEX.md](./TECH_STANDARD_HOST_AUTH_CODEX.md) — 架構、硬性規則、驗收標準  
> **本文件：** 逐步操作手冊（怎麼開機、怎麼填網址）

## 交接首選：終端機貼一次

在 Mac 終端機**整段貼上**：

```bash
cd "/Users/kaine/Desktop/Projects/WikiNB for KCIS" && chmod +x host/one-command-mac.sh host/stop-mac.sh && ./host/one-command-mac.sh
```

腳本會自動：檢查／安裝 cloudflared、開 Auth、開 Tunnel、寫入 `productionUrl` 與 `.env`。  
結束時再給你**一行 push**，再貼一次就更新線上站。停止：`./host/stop-mac.sh`

---

## 概念

```text
職員瀏覽器
  │
  ├─ 筆記／UI  →  https://zx50416.github.io/WikiNB-KCIS/   （GitHub Pages）
  │
  └─ 登入／Codex →  https://＜Tunnel＞  →  部署主機 :8788
                                          ├─ Auth（寄信、帳密）
                                          └─ Codex CLI（這台電腦上的）
```

| 階段 | 部署主機 | Codex |
|------|----------|--------|
| **現在** | 你的 **Mac** | Mac 上的 Codex CLI |
| **未來** | 學校 **Windows 桌機** | 那台 Windows 的 Codex CLI |

前端（Pages）不用搬；**整份 repo + `auth/.env` + Tunnel** 搬到新主機即可。職員仍開同一個 github.io，不用自己裝 Node。

---

## 現在（Mac）要做的

### 1. 本機依賴

```bash
cd "/Users/kaine/Desktop/Projects/WikiNB for KCIS"
npm install
npm run auth:install
# 確認本機已登入／可用 Codex CLI
```

### 2. `auth/.env`（主機模式）

```env
HOST=127.0.0.1
PORT=8788
FRONTEND_ORIGINS=https://zx50416.github.io
COOKIE_SAMESITE=none
# Tunnel 網址取得後再填（見下一步）
# AUTH_BASE_URL=https://xxxx.trycloudflare.com

DEV_LOG_CODE=false
SMTP_USER=kainnne@kcis.com.tw
SMTP_PASS=你的應用程式密碼
# …
LLM_PROVIDER=codex
```

### 3. 開兩個終端機

```bash
# 終端機 A — Auth + Codex
chmod +x host/start-mac.sh host/tunnel-mac.sh
./host/start-mac.sh

# 終端機 B — HTTPS Tunnel
./host/tunnel-mac.sh
```

若尚未安裝 cloudflared：

```bash
brew install cloudflared
```

### 4. 把 Tunnel 網址寫進設定並更新線上站

假設 Tunnel 顯示 `https://abc-xyz.trycloudflare.com`：

1. `config/sites.json` → `"productionUrl": "https://abc-xyz.trycloudflare.com"`
2. `auth/.env` → `AUTH_BASE_URL=https://abc-xyz.trycloudflare.com`
3. 重啟 `./host/start-mac.sh`
4. `git add config/sites.json && git commit && git push`（更新 Pages）

之後職員開 https://zx50416.github.io/WikiNB-KCIS/login 即可登入，請求會打到 **你的 Mac**，Codex 也用 Mac 的 CLI。

> Quick Tunnel 每次網址可能變；正式請用 [Named Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/) 固定網域，就不用常改 `productionUrl`。

### 5. 開發時（只有你）

仍可用本機雙開（不經 Pages）：

```bash
npm run auth
npm run dev
# http://127.0.0.1:4321/WikiNB-KCIS/login
```

---

## 未來搬到 Windows 桌機

1. 把整個專案資料夾（或 `git clone`）放到 Windows  
2. 安裝 Node.js LTS、Codex CLI、cloudflared  
3. 複製 `auth/.env`（或依 `.env.example` 重填）  
4. `npm install` / `npm run auth:install`  
5. PowerShell：

```powershell
.\host\start-windows.ps1
.\host\tunnel-windows.ps1
```

6. 若 Tunnel 網址變了：更新 `productionUrl` + `AUTH_BASE_URL` → push Pages  
7. **Mac 可關 Auth**；職員仍用同一個 github.io  

路徑、防火牆允許 Node／cloudflared 即可；程式邏輯相同。

---

## 檢查清單

| 項目 | Mac 現在 | Windows 未來 |
|------|----------|--------------|
| Node + `npm run auth` | ☐ | ☐ |
| Codex CLI 可用 | ☐ | ☐ |
| cloudflared Tunnel | ☐ | ☐ |
| `productionUrl` 已寫入並 push | ☐ | ☐ |
| SMTP 可寄驗證碼 | ☐ | ☐ |
| 用 github.io 能登入 | ☐ | ☐ |
| Codex 頁能問答 | ☐ | ☐ |

---

## 和舊文件的關係

- [DEPLOY_PRIVATE_PAGES.md](./DEPLOY_PRIVATE_PAGES.md) — Pages／public repo  
- 本文件 — **主機（Mac→Windows）+ Tunnel + Codex** 才是職員可登入的關鍵  
