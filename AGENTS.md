# WikiNB for KCIS — Agent 規則

## 專案是什麼

康橋（KCIS）教學筆記知識庫 +（規劃中）AI 複習助理。

- 多老師資料夾：`wiki/teachers/{teacher_id}/{subject_id}/`
- 固定 keywords：**老師名字** + **科目**
- 品牌：康橋藍／紫 + `public/brand/kangchiao-logo.png`
- 詳細規格：`docs/REQUIREMENTS_AND_TECH.md`

## 目前階段

- ✅ 靜態瀏覽／搜尋初版、介面中英切換
- ✅ Auth 骨架：`auth/` Google 登入、僅 `@kcis.com.tw`
- ⏳ 等你完成 Google Cloud 憑證（`docs/AUTH_GOOGLE_SETUP.md`）後才能真的登入

## 改內容時

1. 筆記放在正確老師／科目資料夾
2. frontmatter 含 `teacher`、`teacher_id`、`subject`、`subject_id`、`keywords`（兩項）、`status`
3. 更新 `wiki/index.md`（若需要人讀目錄）
4. 網站程式以 `src/lib/wiki.ts` 為讀取單一來源
5. 密鑰只放 `auth/.env`，勿 commit

## 品牌

- 勿使用個人 WikiNB（Kainnne）粉紅主題
- 使用 CSS 變數：`--kc-blue`、`--kc-purple`、`--kc-mist` 等

## 本地指令

```bash
npm install
npm run auth:install
cp auth/.env.example auth/.env   # 填 Google 憑證
npm run auth                     # http://127.0.0.1:8788
npm run dev                      # http://127.0.0.1:4321/WikiNB-KCIS/
```
