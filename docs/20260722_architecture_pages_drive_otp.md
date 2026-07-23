# 2026-07-22｜WikiNB for KCIS 架構定稿：Pages 前端 × 私有後端 × Shared Drive

> 文件檔名：`docs/20260722_architecture_pages_drive_otp.md`  
> 狀態：**登入（Email OTP）已實作到成功頁**；Drive 儲存層已接好，需補服務帳號 JSON 才會寫入 Shared Drive  
> 相關討論：公開前端／私有後端／筆記不進 GitHub

---

## 1. 一句話分工

**Shared Drive 存原始筆記；後端負責登入、同步與（未來）檢索；向量索引放後端資料庫；GitHub Pages 只負責畫面。**

瀏覽器**只**連 GitHub Pages（UI）與私有後端 API，**不**直連 Gemini、RAG 或 Drive。

---

## 2. 目標架構

```text
老師／學生瀏覽器
        ↓
GitHub Pages 靜態前端（https://zx50416.github.io/WikiNB-KCIS/）
        ↓ HTTPS
私有後端 API（目前：Mac + Cloudflare Tunnel；目標：Cloud Run 等）
├── Email 驗證碼登入／sessions
├── 暱稱與角色（student／teacher／admin）
├── 寄送驗證信（SMTP；測試 chaos60649@gmail.com）
├── Google Drive 讀寫（老師筆記）
├── Gemini API key（只在後端；測試中）
└── （下一階段）RAG 查詢
        ↓
├── KCIS Shared Drive：原始教材與筆記
│   資料夾 ID：1laJhgrMRe9kK9arXk8LM2EJ9FseUK_X4
├── Database／JSON：users、sessions、roster 覆寫
└── （下一階段）Vector DB：chunks、embeddings
```

| 層 | 放什麼 | 可否公開 |
|----|--------|----------|
| GitHub repo | 程式碼、README、`.env.example`、示範資料 | 試用期建議 **private**；整理後可 public showcase |
| GitHub Pages | 靜態 UI | ✓ |
| Shared Drive | 老師 `.md`／教材 | ✗（校內權限） |
| 後端 secrets | API key、SMTP、服務帳號、SESSION_SECRET | ✗ |
| users／sessions | 信箱、暱稱、角色、登入狀態 | ✗（不存筆記全文） |

---

## 3. 登入與身分（已實作）

### 3.1 誰可以登入

- 所有 `@kcis.com.tw`
- 例外測試信箱：`chaos60649@gmail.com`（`EXTRA_ALLOWED_EMAILS`）

### 3.2 角色

| 條件 | 角色 |
|------|------|
| `roster.json` 標 `admin`／`teacher`／`student` | 照名單 |
| `EXTRA_TEACHER_EMAILS`（預設含 chaos60649） | teacher（若未標 admin） |
| 其餘 `@kcis.com.tw` | **student** |
| 誤標成學生 → 管理員改 roster 為 teacher | 下次登入生效，並建立資料夾 |

### 3.3 流程（到登入成功頁）

```text
/login
  → 輸入 Email → 後端寄六位數驗證碼
  → 輸入驗證碼
      ├─ 尚無暱稱 → /login/setup（只填暱稱）
      └─ 已有暱稱 → 直接發 session
  → /login/success（Hello! {暱稱}）
```

- **不再以密碼為主**（舊密碼 API 仍相容，UI 已改 OTP）
- 右上角顯示 `Hello! {暱稱}`，可點擊修改暱稱
- 暱稱規則：中文、A–Z、a–z、`_`、`.`；長度 2～20

### 3.4 teacherId vs 暱稱

- 資料夾 id：信箱 `@` 前（例：`kainnne@kcis.com.tw` → `kainnne`）
- 暱稱可改；**資料夾永不因改名而搬動**
- 路徑：`teachers/{teacherId}/general/*.md`（Drive 與本機鏡像相同結構）

### 3.5 老師 vs 學生能力

| 能力 | 學生 | 老師／管理員 |
|------|:----:|:------------:|
| OTP 登入、暱稱 | ✓ | ✓ |
| （未來）Gemini 複習 | ✓ | ✓ |
| 上傳 MD、編輯器、同步 Wiki | ✗ | ✓ |

---

## 4. Wiki 儲存：Google Shared Drive

### 4.1 設定（`auth/.env`）

```env
GOOGLE_DRIVE_FOLDER_ID=1laJhgrMRe9kK9arXk8LM2EJ9FseUK_X4
GOOGLE_SERVICE_ACCOUNT_FILE=auth/secrets/drive-sa.json
```

### 4.2 你還需要做的一步（才能真正寫進 Drive）

Gemini API key **不能**存取 Drive。請用 Google Cloud 專案（你文件中的 `projects/12117517154`）建立**服務帳號**：

1. 啟用 **Google Drive API**
2. 建立服務帳號 → 下載 JSON → 存成 `auth/secrets/drive-sa.json`（已 gitignore）
3. 把服務帳號的 `client_email` 加進該 Shared Drive／資料夾，權限至少「內容管理員」
4. 重啟 Auth：`npm run auth` 或 `./host/one-command-mac.sh`

未放服務帳號時：後端仍可登入；筆記暫寫本機 `wiki/` 鏡像，並在 health／同步訊息提示 Drive 未設定。

### 4.3 「同步 Wiki」語意

- Drive 已設定：筆記真實來源在 Drive；同步＝確認狀態（後續接 RAG／Pages 快照）
- **不再**把老師真實筆記 `git push` 當主流程（避免個資進 GitHub）

---

## 5. 密鑰放哪裡

| 項目 | 位置 |
|------|------|
| SMTP 應用程式密碼、Gemini key、SESSION_SECRET | `auth/.env`（gitignore） |
| Drive 服務帳號 | `auth/secrets/drive-sa.json` |
| 本機備註 | 根目錄 `帳號密碼.md`（已 gitignore，勿 commit） |
| 範本 | `auth/.env.example`（無真實密鑰） |

正式寄件：`no-reply@kcis.com.tw`（需資訊組；測試期用 chaos60649 Gmail SMTP）。

---

## 6. 與 GitHub Pages 的關係

- Pages **繼續部署**前端（Astro build）
- 線上登入仍需後端 HTTPS（目前 Tunnel → Mac `:8788`）
- 靜態站**不**內嵌 API key；瀏覽器只打 `config/sites.json` 的 `auth.productionUrl`

過渡期可留 Mac + Tunnel；長期建議 Cloud Run（或學校核准託管）。

---

## 7. 實作進度（本文件當日）

| 項目 | 狀態 |
|------|------|
| Email OTP 登入 → `/login/success` | ✅ |
| 暱稱規則與可修改 | ✅ |
| `@kcis` 預設學生、roster 升老師 | ✅ |
| Drive 模組＋老師開通建立資料夾 | ✅（需服務帳號才寫入雲端） |
| Gemini 串流聊天／RAG | ⏳ 下一階段（key 已進 `.env`） |
| 後端搬 Cloud Run | ⏳ |
| repo 全面清掉真實信箱後 public | ⏳ 建議試用期保持 private |

**過渡期登入方式（2026-07-22 更新）：**

- **請用本機**：`npm run auth` + `npm run dev` → http://127.0.0.1:4321/WikiNB-KCIS/login  
- **不要**再開舊的 `./host/one-command-mac.sh` Tunnel（`productionUrl` 已清空）  
- GitHub Pages 目前只有靜態畫面；線上 OTP 登入要等 Cloud Run（或等價 HTTPS 後端）  
- 筆記真實來源仍是 Shared Drive（服務帳號須在 Drive 成員名單內）

---

## 8. 本機快速測試

```bash
cd "/Users/kaine/Desktop/Projects/WikiNB_for_KCIS"
npm run auth          # 終端機 1：http://127.0.0.1:8788
npm run dev           # 終端機 2：http://127.0.0.1:4321/WikiNB-KCIS/
```

開啟 `/WikiNB-KCIS/login` → 用 `chaos60649@gmail.com` 或 `kainnne@kcis.com.tw` 收碼 → 成功頁應出現 `Hello! …`。

線上：Pages + 主機 Tunnel（見 `docs/HOST_DEPLOY.md`）。

---

## 9. 修訂紀錄

| 日期 | 說明 |
|------|------|
| 2026-07-22 | 初版定稿：OTP、Drive 分層、Pages 只做 UI；實作到登入成功頁 |
