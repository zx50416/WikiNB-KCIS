# 資安管控建議 × 老師／學生開通方式

> 適用：WikiNB for KCIS（預核名單 + 驗證碼設密碼 + 帳密登入）  
> 更新日期：2026-07-20

---

## 1. 目前帳號怎麼運作（先懂這個）

| 概念 | 位置 | 說明 |
|------|------|------|
| **預核名單 (roster)** | `auth/data/roster.json` | 誰「被允許」設密碼／登入；含 `role` |
| **使用者庫 (users)** | `auth/data/users.json` | 已設過密碼的人（密碼為 bcrypt 雜湊） |
| **設定** | `auth/.env` | Session 密鑰、SMTP、LLM 等（**勿 commit**） |

流程：

1. 管理員把 Email 寫進 **roster**（開通資格）  
2. 使用者第一次：只填 Email → 系統自動寄驗證碼 → 驗證碼 + 新密碼 + 確認密碼 → 登入  
3. 之後：只填 Email → 偵測已設密碼 → 輸入密碼登入  
4. 忘記密碼：在密碼步驟按「忘記密碼」→ 再走驗證碼設新密碼  

**未在 roster → 無法寄碼、無法登入。**  
不是靠「網域長得像康橋」自動過關。

---

## 2. 開通測試帳：`kainnne@kcis.com.tw`（已列入名單）

名單狀態（預設已寫入）：

```json
{
  "email": "kainnne@kcis.com.tw",
  "name": "Kaine",
  "role": "admin"
}
```

### 你要做的步驟（約 3 分鐘）

1. **終端機 1 — 啟動 API**

```bash
cd "/Users/kaine/Desktop/Projects/WikiNB for KCIS"
npm run auth
```

看到類似：`WikiNB KCIS API  http://127.0.0.1:8788`

2. **終端機 2 — 啟動網站**

```bash
cd "/Users/kaine/Desktop/Projects/WikiNB for KCIS"
npm run dev
```

開啟：http://127.0.0.1:4321/WikiNB-KCIS/login  

（線上站 https://zx50416.github.io/WikiNB-KCIS/ 可瀏覽筆記；**登入請用本機網址**，見 [DEPLOY_PRIVATE_PAGES.md](./DEPLOY_PRIVATE_PAGES.md)）

3. **首次設定密碼**

- 登入頁**先只填** `kainnne@kcis.com.tw` →「繼續」  
- 系統偵測尚未設密碼 → **自動寄驗證碼**（未設 SMTP 時看 Auth 終端機）  
- 輸入驗證碼、新密碼、確認新密碼 → 登入  

4. 成功後可用 Codex、右上角會顯示已登入。

### 若要重設 kainnne 密碼

同樣走「忘記密碼／首次設定」寄碼即可；或刪掉 `auth/data/users.json` 裡該使用者後重設（開發用）。

### 若要真的寄到學校信箱

在 `auth/.env` 設定 Gmail 應用程式密碼等 SMTP 變數，並把 `DEV_LOG_CODE=false`（正式環境建議）。  
見 `auth/.env.example`。

---

## 3. 如何加入老師／學生

### 3.1 手動加入（現在就用這個）

編輯 **`auth/data/roster.json`**（可先複製 `roster.example.json`）。

**學生範例：**

```json
{
  "email": "student01@stu.example.com",
  "name": "王小明",
  "role": "student"
}
```

**老師範例：**

```json
{
  "email": "chen@example.com",
  "name": "陳老師",
  "role": "teacher",
  "teacherId": "demo-chen"
}
```

| 欄位 | 必填 | 說明 |
|------|:----:|------|
| `email` | ✅ | 登入用；建議小寫 |
| `name` | 建議 | 顯示名稱 |
| `role` | ✅ | `admin` / `teacher` / `student` |
| `teacherId` | 老師建議 | 對應 `wiki/teachers/{teacherId}/` |

存檔後**不必重開網站**；下次寄碼／登入時會讀新名單。  
（若 API 有快取疑慮，重開一次 `npm run auth` 最保險。）

通知對方：

1. 開啟登入頁  
2. 用該 Email 走「首次設定」  
3. 收驗證碼（或請你看 DEV 終端機）→ 設自己的密碼  

### 3.2 批次加入

- 用試算表整理 Email、姓名、角色  
- 匯出 JSON 陣列，覆蓋或合併進 `roster.json`  
- **不要**把真實全校名單 commit 到公開 Git  

### 3.3 未來：Google Workspace 自動同步（尚未實作）

可行方向（需資訊組授權）：

1. Workspace Admin / Directory API 讀取使用者或群組  
2. 定期寫入 roster（或資料庫）  
3. 依群組對應 `student` / `teacher`  

這不是「開了 Workspace 就自動出現」，要另外做同步與權限申請。  
短期請維持手動／CSV。

### 3.4 角色權限（規劃）

| role | 預期能力（隨功能成熟） |
|------|------------------------|
| `admin` | 管理人選、審核、全站設定 |
| `teacher` | 管理自己的 `teacherId` 資料夾、上傳／編輯教材 |
| `student` | 瀏覽已發布筆記、使用 Codex／CLI 複習 |

老師與學生**登入手段相同**；差別在 roster 的 `role`（與之後的 API 權限檢查）。

---

## 4. 資安管控建議

### 4.1 必做（現在起）

| 項目 | 做法 |
|------|------|
| 密鑰不上 Git | `auth/.env`、`users.json`、含真實個資的 `roster.json` 已在 `.gitignore` 精神內；勿強制加入版本庫 |
| 夠強的 `SESSION_SECRET` | 正式環境用長隨機字（如 `openssl rand -hex 32`） |
| 開發驗證碼 | `DEV_LOG_CODE=true` 僅本機；正式改 SMTP 並關閉終端機印碼 |
| 最小名單 | 試用期只開需要的帳，不要一次匯入全校 |
| 本機權限 | 筆電登出／磁碟加密；勿把專案放在共享資料夾給無關的人 |

### 4.2 正式給學生用之前

| 項目 | 做法 |
|------|------|
| HTTPS | Auth API 與網站都走 https |
| 限流 | 登入／寄碼 API 限制次數（防撞庫、防刷信） |
| SMTP | 驗證碼寄到本人信箱，勿長期依賴終端機 |
| 備份 | 定期備份 roster／users（加密存放） |
| 主機 | 勿長期用個人筆電當唯一正式伺服器 |
| 對話 log | Codex／AI 對話若存檔，設保留天數、避免存多餘個資 |
| 依賴更新 | 定期 `npm audit`，修高危漏洞 |

### 4.3 資料敏感度（務實）

- 目前常見個資：**Email、顯示姓名、角色**  
- 密碼：僅存雜湊，仍要保護 `users.json`（可離線撞雜湊，雖成本高）  
- 筆記內容：多半非個資，但仍可能含班級資訊 → 權限與發布狀態要控  

「網站被駭 → 全校個資外流」通常來自：**密鑰／名單外洩、公網裸奔 API、誤推 Git**。  
預核名單本身有助降低「陌生人註冊」；不能取代 HTTPS 與密鑰管理。

### 4.4 合規提醒

服務對象含未成年學生時，除技術外需與學校確認個資告知／同意與保存政策。技術上要能配合刪除某帳號（從 roster + users 移除）。

### 4.5 緊急處理（懷疑外洩時）

1. 停止對外 Auth／輪替 `SESSION_SECRET`（會踢掉所有人重新登入）  
2. 請相關使用者改密碼  
3. 檢查 Git 歷史是否誤傳 `.env`／名單；必要時作廢 SMTP 應用程式密碼  
4. 通知學校資訊窗口（若已上正式環境）

---

## 5. 快速檢查清單

**開通一人**

- [ ] 寫入 `roster.json`  
- [ ] `npm run auth` 有在跑  
- [ ] 對方完成驗證碼設密碼  
- [ ] 能登入 `/login`，admin／teacher 可進 `/codex`（依權限）

**上線前資安**

- [ ] `.env` 未進 Git  
- [ ] HTTPS + 強 `SESSION_SECRET`  
- [ ] SMTP 已測通、關閉 DEV 印碼  
- [ ] 已設登入／寄碼限流（實作後勾）  
- [ ] 備份與還原演練過一次  

---

## 6. 相關文件

| 文件 | 內容 |
|------|------|
| [AUTH_ROSTER_PASSWORD.md](./AUTH_ROSTER_PASSWORD.md) | 登入架構與 LLM |
| [REQUIREMENTS_AND_TECH.md](./REQUIREMENTS_AND_TECH.md) | 整體需求與部署 |
| `auth/data/roster.example.json` | 名單範本 |
| `auth/.env.example` | 環境變數範本 |

---

*本文件隨專案演進更新；Workspace 自動同步實作後，於 §3.3 補上實際指令與權限申請步驟。*
