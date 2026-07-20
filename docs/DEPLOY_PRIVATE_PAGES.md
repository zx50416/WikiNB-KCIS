# 部署說明（Public Pages + 本機 Auth）

## 線上網址（已上線）

| 項目 | 網址 |
|------|------|
| 網站 | **https://zx50416.github.io/WikiNB-KCIS/** |
| Repo | https://github.com/zx50416/WikiNB-KCIS （public） |
| 登入／Codex | 本機 `npm run auth` + `npm run dev` → http://127.0.0.1:4321/WikiNB-KCIS/ |

## 架構

```text
GitHub Pages（靜態網站，HTTPS）
  https://zx50416.github.io/WikiNB-KCIS/
        │
        │ 瀏覽／搜尋筆記：可直接用
        │ 登入／Codex：瀏覽器會擋 HTTPS→HTTP 本機，請改用本機網站
        ▼
本機 Auth :8788（寄信 + 登入 + Codex CLI）
  http://127.0.0.1:8788
```

與個人 WikiNB 相同：Pages 給固定網址逛內容；登入與 AI 仍靠本機 API。

## Public repo 放什麼／不放什麼

| 可進 git | 不要進 git |
|----------|------------|
| 網站程式、wiki 筆記、roster 預核名單 | `auth/.env`（SMTP、SESSION_SECRET） |
| `.env.example` | `auth/data/users.json`（密碼雜湊） |

## 為什麼 github.io 登入會顯示「未連線」？

即使本機已執行 `npm run auth`，在 **https://zx50416.github.io/...** 開登入頁時，瀏覽器基於安全會阻擋頁面呼叫 **http://127.0.0.1:8788**（HTTPS 頁面不能打 HTTP 本機）。

**正確測登入／Codex：**

```bash
cd "/Users/kaine/Desktop/Projects/WikiNB for KCIS"
npm run auth    # 終端機 1
npm run dev     # 終端機 2
```

開啟：**http://127.0.0.1:4321/WikiNB-KCIS/login**

## SMTP（用 kainnne 代寄信）

編輯本機 `auth/.env`（勿 commit）：

```env
DEV_LOG_CODE=false
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=kainnne@kcis.com.tw
SMTP_PASS=你的16碼應用程式密碼
SMTP_FROM=WikiNB KCIS <kainnne@kcis.com.tw>
FRONTEND_ORIGINS=https://zx50416.github.io
```

重啟 `npm run auth` 後再測。

## 更新線上站

推送到 `master` 會自動跑 GitHub Actions → Pages。

```bash
git add -A && git commit -m "..." && git push
```
