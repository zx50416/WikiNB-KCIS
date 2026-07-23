# WikiNB for KCIS — 需求規格與技術設計

> 文件版本：v0.1  
> 更新日期：2026-07-20  
> 狀態：初版網頁與資料夾結構已開工；**登入／身分系統下一步再做**

---

## 1. 專案一句話

**WikiNB for KCIS** 是康橋國際學校（KCIS）的「教學筆記知識庫 + AI 複習助理」：

- 每位老師有自己的資料夾，上傳／整理教學 Markdown
- 每篇筆記固定兩個關鍵字：**老師名字**、**科目**
- 學生登入後（含未來 CLI）可依「哪個老師、哪一科」或「全部課程」提問複習
- 第一版 AI 可接本機 Codex CLI 測試；正式環境要能改接到其他推理主機

本專案參考個人版 [WikiNB / Kainnne](../../WikiNB) 的「wiki 筆記 + 搜尋 + Bridge」思路，但**重新設計為多老師租戶、學校身分、康橋品牌**，不可直接把單人帳密／本機 Bridge 放大成全校系統。

姊妹視覺參考：康橋 AI 應用導航站  
`Desktop/康橋/應用導航網站_20260717`（線上：https://zx50416.github.io/KCIS_AI_website/）

---

## 2. 產品目標與非目標

### 2.1 目標（要做）

| 優先 | 能力 |
|------|------|
| P0 | 依老師／科目組織的 wiki 資料夾與 frontmatter 規範 |
| P0 | 公開／校內可瀏覽的初版網站：首頁、搜尋、筆記頁（康橋配色與 logo） |
| P1 | 老師上傳 MD；線上表單編輯器 → 轉成 MD → 存雲端或本機 → 發布／同步 |
| P1 | 學生登入（大規模）；依 keywords 篩選後問 AI |
| P1 | Chat API 抽象層：v0 接 Codex CLI，正式可換其他主機 |
| P2 | CLI 給學生複習（先內部測試） |
| P2 | 管理員：開老師帳、審核、用量與稽核 |

### 2.2 非目標（初版刻意不做）

- 完整登入／SSO（下一步專案階段）
- 正式環境仍依賴「某台 Mac 開機才有後端」
- 把學生個資、對話紀錄推上公開 GitHub
- 老師互改對方資料夾
- 完整 LMS（點名、成績、作業繳交）— 本專案是知識庫 + 複習助理，不是教務系統

---

## 3. 使用者需求（整理自產品討論）

### 3.1 老師

1. 每位老師有獨立資料夾（租戶邊界）。
2. 登入後可上傳教學 `.md`，並帶入／維護兩個固定 keywords：**老師名**、**科目**。
3. 希望有**線上編輯**：
   - 提供結構化欄位（標題、單元、重點、例題…），方便整理文字
   - 可轉成 Markdown
   - 可存到**雲端或本機**
   - 再按「同步／發布 Wiki」讓學生端可見
4. 版面需康橋配色與 logo（延續 `kcis_ai_website` 視覺）。

### 3.2 學生

1. 未來登入網站或使用設計中的 CLI。
2. 可問「哪個老師的哪一科」，方便複習；也可問「所有課程」。
3. AI 回答應盡量依教材，並能標示來源（老師／科目／檔名）。

### 3.3 系統維運（你／資訊組）

1. 部署位置要規劃清楚（靜態站 ≠ 可寫入後端 ≠ AI worker）。
2. 必須處理資安：身分、權限、上傳、AI prompt、個資與稽核。
3. AI 後端可替換，不可鎖死 Codex CLI。

### 3.4 內容模型（Keywords）

- **固定兩個 keywords**：`teacher`（老師顯示名）、`subject`（科目顯示名）
- 技術上另存穩定 id：`teacher_id`、`subject_id`（slug），避免改名或同名衝突
- 搜尋與 CLI 篩選以這兩個為主；`tags` 可當額外標籤（選用）

---

## 4. 角色與權限（設計原則，實作分階段）

| 角色 | 讀 published | 讀 draft | 寫自己資料夾 | 寫他人 | Chat／CLI | 管理後台 |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| 訪客（未登入） | 視政策＊ | ✗ | ✗ | ✗ | ✗ | ✗ |
| 學生 | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ |
| 老師 | ✓ | 僅自己 | ✓ | ✗ | ✓ | ✗ |
| 管理員 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

＊政策待拍板：教材是否必須登入才看。初版網站可先**展示示範筆記**方便開發；正式上線再關公開讀取。

---

## 5. Wiki 資料夾格式（初版已落地）

```text
wiki/
├── README.md                 # 給老師／維護者的目錄說明
├── index.md                  # 人讀目錄（可半自動維護）
└── teachers/
    └── {teacher_id}/         # 例：demo-chen
        ├── _meta.json        # 老師中繼資料
        └── {subject_id}/     # 例：math
            ├── _meta.json    # 科目中繼資料（含 keywords）
            └── {note-slug}.md
```

### 5.1 `_meta.json`（老師）

```json
{
  "id": "demo-chen",
  "name": "陳老師",
  "displayName": "陳老師",
  "subjects": ["math"],
  "status": "active"
}
```

### 5.2 `_meta.json`（科目）

```json
{
  "id": "math",
  "name": "數學",
  "teacherId": "demo-chen",
  "keywords": ["陳老師", "數學"],
  "status": "active"
}
```

### 5.3 筆記 frontmatter（必填建議）

```yaml
---
title: 分數加減導論
description: 認識真分數、假分數與加減規則
teacher: 陳老師
teacher_id: demo-chen
subject: 數學
subject_id: math
keywords:
  - 陳老師
  - 數學
status: published          # draft | published
audience: students         # students | teachers-only
date: 2026-07-20
updated: 2026-07-20
tags:                      # 選用，非固定 keywords
  - 分數
---
```

### 5.4 URL／slug 規則

- 檔案路徑：`wiki/teachers/{teacher_id}/{subject_id}/{note}.md`
- 網站路徑：`/wiki/teachers/{teacher_id}/{subject_id}/{note}`
- slug 僅允許：英文、數字、連字號、底線（資料夾 id）；顯示名用中文放在 frontmatter／meta

### 5.5 Wikilink

- `[[teachers/demo-chen/math/fractions-intro]]` 或短名策略（後續可加別名表）
- 初版解析：`[[完整相對 wiki 路徑]]` 與同科目相對連結

---

## 6. 網站資訊架構（初版）

| 路徑 | 說明 | 初版 |
|------|------|------|
| `/` | 首頁：品牌、搜尋入口、最近更新、老師／科目導覽 | ✅ |
| `/search` | 搜尋與展開瀏覽；可依老師／科目關鍵字過濾 | ✅ |
| `/wiki/[...slug]` | 筆記專頁 | ✅ |
| `/teachers` | 老師列表（由 `_meta.json` 產生） | ✅ |
| `/login` | 預核名單登入（Email → 驗證碼 → 密碼；老師需暱稱） | ✅ |
| `/editor` | 老師線上 Markdown 編輯器（上傳／下載／儲存） | ✅ |
| `/rename` | 老師重新命名筆記檔名 | ✅ |
| `/codex` | Codex CLI 複習助理（串流、上傳 MD） | ✅ |

品牌：

- 名稱建議：**WikiNB · KCIS** 或「康橋教學筆記庫」（可再定）
- 配色：康橋藍 `#1b4f9c`、康橋紫 `#6b3d9a`、霧底 `#f4f1fa`（同導航站）
- Logo：`public/brand/kangchiao-logo.png`

---

## 7. 老師編輯器（規劃，尚未實作）

### 7.1 使用流程

```text
登入（老師）
  → 選擇／建立「科目」
  → 表單欄位填寫（或上傳既有 .md）
  → 即時預覽 Markdown
  → 存草稿（雲端為主；可選下載本機 .md）
  → 按「發布／同步 Wiki」→ status=published → 學生可見
```

### 7.2 建議表單欄位（可對應 MD 區塊）

| 欄位 | 對應 MD |
|------|---------|
| 標題 | frontmatter `title` + `#` |
| 科目／老師 | keywords（自動帶入，不可亂改他人） |
| 一句话摘要 | `description` |
| 學習目標 | `## 學習目標` |
| 本課重點 | `## 本課重點` |
| 例題與說明 | `## 例題` |
| 練習／作業 | `## 練習` |
| 補充／注意 | `## 注意事項` |
| 進階：純 MD | 覆蓋／合併進 body |

技術選型建議（之後實作時再定）：

- 表單 UI：Astro 頁 + 少量 client script，或 React island
- MD 預覽：`marked`（與現站相同）
- 進階編輯：CodeMirror 6 或 TipTap（若要 WYSIWYG）

### 7.3 儲存策略

| 階段 | 建議 |
|------|------|
| 原型 | 寫入本機 `wiki/`（類似個人 WikiNB Bridge）僅供開發 |
| 試用／正式 | **雲端為單一真相**：物件儲存或 DB + 檔案；本機下載只是匯出 |
| 「同步 Wiki」 | 正式版＝API `publish`；可另選產生靜態站建置，**不要**讓每位老師直接 `git push` 同一 repo |

---

## 8. 學生 AI／CLI（規劃）

### 8.1 查詢語意

- 「陳老師的數學」→ 篩 `teacher_id=demo-chen` + `subject_id=math` 且 `published`
- 「所有課程」→ 全部 `published`（或學生有權限的範圍）
- 回覆附來源：老師、科目、檔名、連結

### 8.2 LLM Adapter（務必做成可抽換）

```text
網站 / CLI
    ↓  JWT / session
Chat API（你的後端）
    ↓  依 keywords 載入教材（或 RAG）
LLM Adapter
    ├─ CodexAdapter      ← v0 測試（本機 CLI）
    ├─ OpenAICompatible  ← 自架 / 校內 GPU / vLLM
    └─ AzureOpenAI / 其他
```

契約建議（概念）：

- `POST /api/chat`：`{ message, teacherId?, subjectId?, history[] }`
- 後端負責：驗證、篩選檔案、組 prompt、呼叫 adapter、寫 audit log
- 前端／CLI **不直接** spawn `codex`

---

## 9. 部署建議

### 9.1 三層拆分

| 層 | 職責 | 建議承載 |
|----|------|----------|
| **靜態前端** | 瀏覽、搜尋頁、品牌 | GitHub Pages / Cloudflare Pages / Vercel |
| **應用 API** | 登入、上傳、發布、Chat | Cloud Run / Fly.io / Railway / 校內 VM |
| **AI Worker** | 實際推理 | v0：開發者 Mac + Codex；正式：校內或雲端 GPU／API |

### 9.2 分階段

| 階段 | 做法 |
|------|------|
| **v0（現在）** | 本 repo Astro 靜態站 + 本機 `npm run dev`；內容在 `wiki/`；無登入 |
| **v1 試用** | 前端上 Pages/Vercel；API 上一台小雲端；身分先 Email 網域或測試帳；AI 仍可轉發 Codex |
| **v2 正式** | 學校 SSO（Google／Microsoft）；教材雲端庫；AI 接正式主機；限流與稽核齊備 |

### 9.3 不建議當正式方案的做法

- 全校依賴單一台 Mac Bridge
- GitHub 公開 repo 當多老師即時寫入主庫
- 自建幾千組明文密碼當唯一學生登入

---

## 10. 資安建議（詳細）

### 10.1 身分與權限

- 正式學生登入優先：**Google Workspace for Education** 或 **Microsoft Entra ID**
- 老師與學生用不同 claim／群組；API 強制檢查「只能寫自己的 `teacher_id`」
- Session／JWT 短效 + refresh；CLI 用 device code／瀏覽器登入，勿存永久密碼
- 個人 WikiNB 的「帳密 + Email OTP」僅適合作為**管理員緊急通道**，不適合全校學生

### 10.2 內容與上傳

- 只允許文字／Markdown（或嚴格 MIME／副檔名白名單）
- 檔名與路徑消毒：禁止 `..`、絕對路徑、過長檔名
- 大小上限、老師配額
- `draft` 絕不可被學生 API 讀取
- 發布前可選審核（尤其含學生個資的內容）

### 10.3 AI 相關

- 教材當「資料」注入，system prompt 禁止模型執行危險工具（正式環境 read-only）
- 防 prompt 注入：分隔使用者輸入與教材；限制輸出長度
- Rate limit（每學生／每 IP）
- 對話 log：脱敏、保留天數、僅管理員可查；注意未成年個資規範

### 10.4 基礎設施

- 全站 HTTPS；CORS 白名單
- Secret 只放環境變數／Secret Manager，不進 git
- 定期備份老師內容與還原演練
- 依賴與 Actions 最小權限（Pages deploy 與內容寫入分離）

### 10.5 合規提醒（非純技術）

若服務對象含未成年學生，需與學校確認：個資蒐集告知、家長同意、資料保存與刪除政策。技術實作需能配合「刪除某學生對話紀錄」等請求。

---

## 11. 與個人 WikiNB 的對照

| 項目 | 個人 WikiNB | WikiNB for KCIS |
|------|-------------|-----------------|
| 租戶 | 單人 | 多老師資料夾 |
| Keywords | 自由 tags | **固定老師名 + 科目** |
| 品牌 | Kainnne 粉紅 | 康橋藍紫 + logo |
| 登入 | 單帳密 + OTP | 學校 SSO／大規模學生（下一步） |
| 寫入 | 本機 Bridge → git push | 正式改 API + 雲端；v0 可暫用檔案 |
| AI | 直連本機 Codex | Adapter；可換主機 |
| 姊妹站 | Me 履歷 | KCIS AI 導航站（視覺／生態） |

可重用：Astro、`wiki` 解析、搜尋 UX、MD 渲染、（未來）串流聊天 UI 概念。  
需重做：權限、儲存、身分、多租戶路徑、品牌、部署拓撲。

---

## 12. 程式目錄（初版 repo）

```text
WikiNB_for_KCIS/
├── README.md
├── AGENTS.md
├── docs/
│   ├── REQUIREMENTS_AND_TECH.md   ← 本文件
│   ├── wiki-structure.md          ← 資料夾與 frontmatter 速查
│   └── roadmap.md                 ← 分期實作
├── config/
│   └── sites.json                 ← 品牌與站台設定
├── public/brand/                  ← 康橋 logo
├── wiki/teachers/...              ← 示範內容
└── src/
    ├── components/
    ├── layouts/
    ├── lib/wiki.ts                ← 讀取巢狀老師／科目筆記
    ├── pages/
    ├── scripts/wiki-search.js
    └── styles/global.css          ← 康橋設計權杖
```

登入、Bridge、編輯器、Chat API：**刻意尚未放入**，避免與下一步身分設計綁死。

---

## 13. 待拍板決策（影響下一階段）

1. 學生帳號來源：Google 教育版 / Microsoft / 其他？
2. 未登入能否看 published 教材？
3. v1 雲端偏好：Vercel + Railway，或必須校內主機？
4. 老師／學生數量級（影響 DB、SSO、限流）？
5. CLI 是否發給學生，或僅內部測試？
6. 正式中文產品名稱？

---

## 14. 參考路徑

| 資源 | 路徑 |
|------|------|
| 個人 WikiNB | `/Users/kaine/Desktop/Projects/WikiNB` |
| 康橋導航站 | `/Users/kaine/Desktop/康橋/應用導航網站_20260717` |
| 本專案 | `/Users/kaine/Desktop/Projects/WikiNB_for_KCIS` |
