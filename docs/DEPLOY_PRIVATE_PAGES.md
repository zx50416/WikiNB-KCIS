# 部署檢查清單（Private repo + Pages + 本機 Auth）

## Private repo 合理嗎？

**合理，而且建議這樣做。**

| 放進 private repo | 不要放進 git |
|-------------------|--------------|
| 網站原始碼、wiki 示範筆記、roster 預核名單 | `auth/.env`（SMTP 應用程式密碼、SESSION_SECRET） |
| `.env.example`（沒有真密碼） | `auth/data/users.json`（密碼雜湊） |

Private 不是資安魔法：有權限的人仍看得到程式與名單；真正敏感的是 **應用程式密碼**，必須只存在本機 `.env`。

## 架構（和個人 WikiNB 一樣）

```text
GitHub Pages（靜態網站）  ←→  本機 Auth :8788（寄信 + 登入 + Codex CLI）
https://zx50416.github.io/WikiNB-KCIS/
```

- 網站連結：部署後約為 `https://zx50416.github.io/WikiNB-KCIS/`
- 登入／寄驗證碼／Codex：你的 Mac 要開著 `npm run auth`
- 用 Pages 測時，瀏覽器會打本機 `127.0.0.1:8788`（只有**你這台電腦**能登入與用 Codex）

## 你要完成的步驟

### A. SMTP（用 kainnne 代寄信）

1. Google 帳戶（kainnne@kcis.com.tw）開啟兩步驟驗證  
2. 產生「應用程式密碼」  
3. 編輯本機 `auth/.env`（參考 `auth/.env.example`）：

```env
DEV_LOG_CODE=false
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=kainnne@kcis.com.tw
SMTP_PASS=你的16碼應用程式密碼
SMTP_FROM=WikiNB KCIS <kainnne@kcis.com.tw>
FRONTEND_ORIGINS=https://zx50416.github.io
```

4. 重啟 `npm run auth`，用另一個 roster Email 測「繼續」→ 信箱應收到驗證碼

### B. GitHub Private + Pages

1. 終端機執行（若 `gh` 說 token 無效）：

```bash
gh auth refresh -h github.com
```

2. 建立 private repo 並推送（首次）：

```bash
cd "/Users/kaine/Desktop/Projects/WikiNB for KCIS"
git add -A
git status   # 確認沒有 auth/.env
git commit -m "Initial WikiNB KCIS scaffold"
gh repo create WikiNB-KCIS --private --source=. --remote=origin --push
```

3. GitHub 該 repo → Settings → Pages → Source：**GitHub Actions**  
4. 等 Actions 綠燈後開啟：  
   **https://zx50416.github.io/WikiNB-KCIS/**

### C. 側試流程

1. 本機 `npm run auth`（已設 SMTP）  
2. 開啟網站連結 → 登入  
3. Email → 驗證碼（看信箱）→ 確認驗證碼 → 新密碼／確認 → 登入  
4. 導覽列應出現 **Codex**；點進去可對話（需本機已安裝 Codex CLI）

## Codex

登入後導覽會顯示 Codex 連結；頁面文案／Markdown／Iansui 字體已對齊個人 WikiNB。  
Codex **必須**在跑 Auth 的那台機器上有 Codex CLI。
