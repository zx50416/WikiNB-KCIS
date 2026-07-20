# Google 登入設定指引（僅限 @kcis.com.tw）

> 給還不熟 Google Cloud 的你：照順序做，每做完一步再告訴我結果（成功／卡住畫面）。  
> 你的測試帳：`kainnne@kcis.com.tw`

---

## 這套登入在做什麼

1. 使用者按「使用 Google 登入」
2. 跳到 Google，用**康橋 Google 帳號**登入
3. 我們的本機／伺服器 Auth 服務檢查信箱是否為 `@kcis.com.tw`
4. 通過才發 session；否則拒絕（非康橋人員無法註冊／登入）

**不會**把 Client Secret 寫進程式碼；只放在 `auth/.env`（已列入 gitignore）。

---

## 你需要準備

- 一台能開瀏覽器的電腦（本機開發即可）
- 能登入 `kainnne@kcis.com.tw` 的權限
- 約 15–25 分鐘（第一次申請 Google OAuth）

風險：低（只建立 Google 專案與 OAuth 憑證；不刪檔、不改學校既有系統）。  
若中斷：可稍後從下一步繼續；未填完的憑證不會影響網站靜態瀏覽。

---

## 步驟 A：建立 Google Cloud 專案

1. 用瀏覽器開啟：https://console.cloud.google.com/
2. 建議用 **`kainnne@kcis.com.tw`** 登入（若學校限制個人 Gmail 建立專案，改用有權限的帳號，之後再跟我說）
3. 上方專案選單 → **新增專案**
4. 專案名稱建議：`WikiNB-KCIS`
5. 建立後，確認左上角已選到這個專案

做完回覆我：「A 完成」或貼錯誤訊息。

---

## 步驟 B：設定 OAuth 同意畫面

1. 左側選單找 **「API 和服務」→「OAuth 同意畫面」**  
   （英文介面：APIs & Services → OAuth consent screen）
2. 使用者類型：
   - 若帳號在康橋 Google Workspace：**選「內部」(Internal)** ← 最理想（只有組織內帳號）
   - 若無法選內部：選「外部」(External)，測試期可加測試使用者
3. 應用程式名稱：`WikiNB KCIS`
4. 使用者支援電子郵件：填你的 `kainnne@kcis.com.tw`
5. 開發人員聯絡資訊：同一信箱
6. 範圍（Scopes）：至少保留 `email`、`profile`、`openid`（預設通常夠用）
7. 儲存並繼續到完成

若選「外部」且在測試模式：到「測試使用者」加入 `kainnne@kcis.com.tw`。

做完回覆：「B 完成／選了內部或外部」。

---

## 步驟 C：建立 OAuth 用戶端 ID

1. **「API 和服務」→「憑證」→「建立憑證」→「OAuth 用戶端 ID」**
2. 應用程式類型：**網頁應用程式**
3. 名稱：`WikiNB KCIS Web`
4. **已授權的 JavaScript 來源**（開發先加這兩個）：
   - `http://127.0.0.1:4321`
   - `http://localhost:4321`
5. **已授權的重新導向 URI**（一定要完全一致）：
   - `http://127.0.0.1:8788/api/auth/google/callback`
   - `http://localhost:8788/api/auth/google/callback`
6. 建立後會看到：
   - **用戶端 ID**（Client ID）
   - **用戶端密鑰**（Client Secret）← 像密碼，不要貼到公開聊天／GitHub

做完：把 Client ID 與 Client Secret **自己先複製到記事本**，回覆「C 完成」（密鑰不要貼在對話裡；下一步用本機檔案填）。

---

## 步驟 D：在本機寫入 `auth/.env`

我會在專案裡準備好 `auth/.env.example`。請你：

```bash
cd "/Users/kaine/Desktop/Projects/WikiNB for KCIS"
cp auth/.env.example auth/.env
```

用編輯器打開 `auth/.env`，填入：

```env
GOOGLE_CLIENT_ID=（貼上你的用戶端 ID）
GOOGLE_CLIENT_SECRET=（貼上你的用戶端密鑰）
ALLOWED_EMAIL_DOMAIN=kcis.com.tw
BOOTSTRAP_ADMIN_EMAIL=kainnne@kcis.com.tw
```

其餘欄位可先保持 example 預設。

做完回覆：「D 完成」。

---

## 步驟 E：啟動 Auth 服務並測試登入

之後我會請你執行（或代你啟動）：

```bash
npm run auth:install
npm run auth
```

另開一個終端跑網站：

```bash
npm run dev
```

開啟登入頁 →「使用 Google 登入」→ 應只能用 `@kcis.com.tw`。

用 `kainnne@kcis.com.tw` 第一次成功登入時，會自動成為 **admin**（由 `BOOTSTRAP_ADMIN_EMAIL` 決定）。

---

## 常見卡住點

| 現象 | 可能原因 |
|------|----------|
| redirect_uri_mismatch | Google Console 的重新導向 URI 與 `.env` 的 `AUTH_BASE_URL` 不一致 |
| 登入後被拒 | 信箱不是 `@kcis.com.tw` |
| 內部應用無法選 | 該 Google 帳號不在 Workspace；改外部＋測試使用者 |
| 學校阻擋建立專案 | 需請資訊組開 GCP／OAuth 權限 |

---

## 資安提醒

- `auth/.env` 永不 commit
- 正式上線後再加正式網域的 redirect URI
- 正式環境請改用 HTTPS 與較長的 `SESSION_SECRET`
