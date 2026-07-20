# WikiNB for KCIS — Agent 規則

## 專案是什麼

康橋（KCIS）教學筆記知識庫 + AI 複習助理（Codex）。

- 多老師資料夾：`wiki/teachers/{teacher_id}/{subject_id}/`
- 固定 keywords：**老師名字** + **科目**
- 品牌：康橋藍／紫 + `public/brand/kangchiao-logo.png`
- 詳細規格：`docs/REQUIREMENTS_AND_TECH.md`

## 目前階段

- ✅ 靜態瀏覽／搜尋、i18n、KaTeX
- ✅ 預核名單登入（Email → 驗證碼 → 密碼）
- ✅ GitHub Pages：https://zx50416.github.io/WikiNB-KCIS/
- ✅ 主機架構（Mac 現在 → Windows 未來）：Auth + Codex CLI + Tunnel  
  **技術守則（必讀）：** [`docs/TECH_STANDARD_HOST_AUTH_CODEX.md`](./docs/TECH_STANDARD_HOST_AUTH_CODEX.md)  
  **操作手冊：** [`docs/HOST_DEPLOY.md`](./docs/HOST_DEPLOY.md)

## 改內容時

1. 筆記放在正確老師／科目資料夾
2. frontmatter 含 `teacher`、`teacher_id`、`subject`、`subject_id`、`keywords`（兩項）、`status`
3. 更新 `wiki/index.md`（若需要人讀目錄）
4. 網站程式以 `src/lib/wiki.ts` 為讀取單一來源
5. 密鑰只放 `auth/.env`，勿 commit
6. 動到登入／部署／Codex 時遵守 `TECH_STANDARD_HOST_AUTH_CODEX.md`（禁止 Pages 直連 HTTP 本機 Auth）

## 品牌

- 勿使用個人 WikiNB（Kainnne）粉紅主題
- 使用 CSS 變數：`--kc-blue`、`--kc-purple`、`--kc-mist` 等

## 本地指令

```bash
npm install
npm run auth:install
cp auth/.env.example auth/.env   # 填 SMTP／密鑰（勿 commit）
npm run auth                     # http://127.0.0.1:8788（開發）
npm run dev                      # http://127.0.0.1:4321/WikiNB-KCIS/
# 正式主機（職員可從 Pages 登入）：
# ./host/start-mac.sh  +  ./host/tunnel-mac.sh
# 並設定 config/sites.json → auth.productionUrl
```

**線上站：** https://zx50416.github.io/WikiNB-KCIS/  
職員登入／Codex = Pages + 主機 HTTPS Tunnel，不是只跑 `npm run auth`。
