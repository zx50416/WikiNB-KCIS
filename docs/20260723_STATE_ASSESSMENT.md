# 2026-07-23｜現況診斷：登入「壞掉」與是否還原／程式是否混亂

> **本文件只做說明，不附帶程式修改。**  
> 對應截圖症狀：登入頁顯示「主機 Auth／Tunnel 目前離線」＋ `one-command-mac.sh`。

---

## 0. 先回答你的兩個問題

| 問題 | 結論 |
|------|------|
| 上兩步是不是調出致命錯誤？要不要整包還原？ | **不必整包還原。** 截圖症狀主要是「開到線上 Pages，它還綁著已失效的 Tunnel `productionUrl`」，不是本機 OTP／roster／Header CSS 把登入 API 寫死。 |
| 目前程式碼是否非常混亂？ | **有明顯技術債與雙軌並行，但還不到無法維護；** 混亂主要來自「已部署的舊架構」與「工作區未提交的新架構」疊在一起。 |

---

## 1. 截圖真正在說什麼（本機 vs 線上）

### 1.1 兩套前端

| 你開的網址 | `auth-config`（實測） | 登入要打誰 |
|------------|----------------------|------------|
| **本機** `http://127.0.0.1:4322/WikiNB-KCIS/login` | `url=http://127.0.0.1:8790`，`productionUrl=""` | 本機 Auth |
| **線上** `https://zx50416.github.io/WikiNB-KCIS/login/` | `url=8788`，`productionUrl=https://reputation-cos-gather-suse.trycloudflare.com` | **已失效的 Cloudflare Tunnel** |

截圖文案（「主機 Auth／Tunnel」「one-command-mac.sh」「已設定 productionUrl」）對應的是 **GitHub Pages 上一次成功部署時寫死的舊設定**，不是今天工作區裡已清空 `productionUrl` 的本機設定。

### 1.2 為什麼會覺得「本機登入也壞了」

常見誤解鏈：

1. 書籤／習慣開 **Pages 線上站**  
2. Pages 只能連 HTTPS 後端 → 舊 Tunnel 已掛 → 顯示離線教學卡  
3. 教學卡叫你跑 `one-command-mac.sh`（舊主機模式）  
4. 同時本機其實可以用 `4322 + 8790`，但若沒開對網址，看起來像「整站登入都壞」

**正確本機登入路徑（現況工作區）：**

```text
終端機 1：cd …/WikiNB_for_KCIS/auth && npm start     → :8790
終端機 2：cd …/WikiNB_for_KCIS && npm run dev        → :4322
瀏覽器：  http://127.0.0.1:4322/WikiNB-KCIS/login
```

不要用 `github.io` 頁面期望連到本機 `127.0.0.1`（瀏覽器混合內容／安全策略也不允許 Pages HTTPS 直連本機 HTTP）。

### 1.3 上兩步實際動到什麼（與這張截圖的關係）

近期工作區變更（未全部推上 Pages）大致包括：

- 預設語系 EN、`Header` 按鈕尺寸、老師資料夾／`list-all`、`chaos60649` 共用 `kainnne` 資料夾、Drive sync  
- `config/sites.json` 工作區已是 `productionUrl: ""`、本機埠 `8790`

這些**不會**讓 Pages 截圖突然出現 Tunnel 文案——那文案來自**已部署的舊包**。  
若本機 `4322` 也曾短暫打不開，原因是 **Astro dev 沒在跑**（只有 Auth 在 8790），屬程序沒啟動，不是邏輯「寫死」。

次要風險（本機才會碰到，與截圖無關）：登入成功後 `await provisionTeacherWorkspace()` 會嘗試 Google Drive；Drive 慢時可能讓「驗證碼通過後」多等幾秒。這是可優化點，**不是**截圖上的 Tunnel 離線卡。

---

## 2. 要不要還原？建議怎麼選

### 2.1 不建議：整包 `git restore` / 回到遠端 master 砍掉工作區

原因：

- 工作區相對 `origin/master` 有大量未提交改動（登入 OTP、Drive、編輯器、我的筆記、科目目錄等），整包還原會**丟掉多日功能**，卻**修不好** Pages 上已部署的舊 Tunnel 網址（那要重新部署或重開 Tunnel）。  
- 遠端 `master` 本身仍帶著 `productionUrl=…trycloudflare.com` 的歷史提交；還原到遠端反而更容易回到「Pages 綁死 Tunnel」狀態。

### 2.2 建議：分層處理（不必還原功能碼）

| 目標 | 做法 |
|------|------|
| 現在要能登入測功能 | 開 **本機** `http://127.0.0.1:4322/WikiNB-KCIS/login`（Auth + `npm run dev` 都要開） |
| 線上 Pages 也要能登 | 二選一：**(A)** 重開 Tunnel 並把新 HTTPS 寫進已部署設定後再推；**(B)** 清空 `productionUrl` 並部署，線上改引導「請用本機登入」（過渡期） |
| 只回退某一失敗實驗 | 針對單一檔／單一行為還原（例如只還 Header），不要整庫還原 |

**結論：針對這張登入截圖，還原程式不是正解；開對本機網址才是。**

---

## 3. 程式碼是否「非常混亂」？誠實評估

評級採三級：**清楚／過渡混亂／危險混亂**。

### 3.1 整體評級：**過渡混亂（中高）**，尚未到無法接管

有清楚的目標架構文件（例如 `docs/20260722_architecture_pages_drive_otp.md`、`TECH_STANDARD_HOST_AUTH_CODEX.md`），但**執行面同時殘留兩代部署模型**：

| 世代 | 特徵 | 現況 |
|------|------|------|
| A. Mac + Cloudflare Tunnel + Pages | `productionUrl`、`one-command-mac.sh`、Pages 直打 Tunnel | **仍在遠端已部署站** |
| B. 本機 Auth OTP +（目標）Cloud Run／Drive | `productionUrl=""`、本機 `8790`／`4322`、Drive 寫筆記 | **工作區進行中，未完整取代線上包** |

兩代文案、文件、腳本並存 → 使用者一開錯網址就會以為「登入壞了」。這是**產品／部署敘事混亂**，多於單一函式寫壞。

### 3.2 相對清楚的部分

- **身分規則**：`auth/lib/account.js`、`domain.js`、`roster.json`（老師／學生／例外信箱）有可追的單一入口。  
- **筆記路徑慣例**：`wiki/teachers/{teacherId}/{subjectId}/*.md`；`teacherId` 不隨暱稱變。  
- **前端打 Auth**：`src/scripts/auth-client.js` 的 `getAuthBase()` 對「本機 vs Pages」有明確分支。

### 3.3 真正亂、容易踩雷的部分

1. **雙來源設定**  
   - 工作區 `config/sites.json` ≠ 已部署 Pages 內嵌 JSON  
   - `auth/.env`、`PUBLIC_AUTH_*`、腳本寫回 `productionUrl` 的歷史行為  
   → 「我改了設定為什麼線上還是舊的？」極常見。

2. **登入後副作用過重**  
   - 登入路徑 `await maybeProvisionTeacher` → 本機建夾 + 可能打 Drive  
   - Drive／網路慢時，使用者體感是「驗證碼對了卻卡住」。

3. **文件世代打架**  
   - `HOST_DEPLOY.md`／`TECH_STANDARD_*` 仍教 Tunnel 一鍵腳本  
   - 新架構文件又說過渡期不要再開舊 Tunnel  
   → Agent／人類都容易照錯手冊。

4. **未提交面積極大**  
   - `git status` 顯示大量修改＋刪除＋新檔；**沒有乾淨的「可回滾版本邊界」**  
   - 這會讓「還原」變成賭運氣，而不是精密回退。

5. **UI／權限狀態靠 CSS class 耦合**（例如 `.hidden` vs `display:inline-flex`）  
   - 已出過登入鍵跳針；屬前端狀態機脆弱，不是後端帳密錯。

### 3.4 「算不算非常混亂？」一句話

- **若問架構目標**：不算一團漿糊，方向（Pages 只做 UI、後端 OTP、Drive 存筆記）是清楚的。  
- **若問日常操作體驗**：算混亂——因為**線上舊包＋本機新包＋兩套文件**同時存在，錯誤訊息還在叫人開 Tunnel。  
- **若問要不要因混亂而整包還原**：**不要**；應先固定「本機怎麼開」，再決定線上要 Tunnel 還是清空 `productionUrl` 重新部署。

---

## 4. 建議的下一步（仍屬操作建議，本文件不改碼）

1. 用本機網址驗證登入是否其實正常：  
   `http://127.0.0.1:4322/WikiNB-KCIS/login`  
2. 確認兩個行程：Auth `:8790`、Astro `:4322`。  
3. 線上站暫時視為「舊 Tunnel 包」；未重新部署前不要用它判斷今天工作區好壞。  
4. 穩定後再做一次**有意圖的提交／部署**，讓 Pages 的 `auth-config` 與工作區一致，並整理文件只留一條官方啟動路徑。

---

## 5. 相關檔案索引

| 檔案 | 用途 |
|------|------|
| `config/sites.json` | 本機／建置時嵌入的 Auth URL |
| `src/scripts/auth-client.js` | `getAuthBase`、離線診斷文案 |
| `src/pages/login.astro` | 登入 UI、離線提示渲染 |
| `auth/server.js` | OTP、session、provision |
| `docs/20260722_architecture_pages_drive_otp.md` | 目標架構定稿 |
| `docs/TECH_STANDARD_HOST_AUTH_CODEX.md` | 舊／正式主機＋Tunnel 技術守則（與過渡敘事並存） |
| `host/one-command-mac.sh` | 舊一鍵 Auth+Tunnel（截圖仍在教這個） |

---

*撰寫目的：回答「要不要還原」與「程式是否非常混亂」，並把登入截圖對到正確根因，避免繼續在錯誤層級上修。*
