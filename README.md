# WikiNB for KCIS

康橋國際學校教學筆記知識庫。

**線上網站：** https://zx50416.github.io/WikiNB-KCIS/  
**原始碼：** https://github.com/zx50416/WikiNB-KCIS  

**主機部署（Mac → 未來 Windows + Codex）：** [docs/HOST_DEPLOY.md](./docs/HOST_DEPLOY.md)  
**需求：** [docs/REQUIREMENTS_AND_TECH.md](./docs/REQUIREMENTS_AND_TECH.md)  
**登入：** [docs/AUTH_ROSTER_PASSWORD.md](./docs/AUTH_ROSTER_PASSWORD.md)  
**資安 × 加人：** [docs/SECURITY_AND_ONBOARDING.md](./docs/SECURITY_AND_ONBOARDING.md)

## 架構（給職員用）

| 層 | 誰負責 | 說明 |
|----|--------|------|
| 網站 UI／筆記 | GitHub Pages | 固定網址，職員直接開 |
| 登入／寄信／Codex | **部署主機** | 現在＝你的 Mac；未來＝Windows 桌機 + 該機 Codex CLI |
| 對外 HTTPS | Cloudflare Tunnel | 讓 Pages 能安全連到主機 Auth |

職員**不需要**自己跑 `npm`。只有主機要開 Auth + Tunnel。

## 主機快速啟動（Mac）

```bash
chmod +x host/*.sh
./host/start-mac.sh      # 終端機 1：Auth + Codex
./host/tunnel-mac.sh     # 終端機 2：HTTPS（需 cloudflared）
```

取得 Tunnel 網址後寫入 `config/sites.json` 的 `auth.productionUrl` 與 `auth/.env` 的 `AUTH_BASE_URL`，再 `git push`。詳見 [docs/HOST_DEPLOY.md](./docs/HOST_DEPLOY.md)。

## 本機開發（僅開發者）

```bash
npm run auth:install   # 首次
npm run auth
npm run dev            # http://127.0.0.1:4321/WikiNB-KCIS/
```

## 資料夾

| 路徑 | 用途 |
|------|------|
| `wiki/teachers/` | 各老師／科目筆記 |
| `auth/` | 登入 API + Codex adapter |
| `host/` | Mac／Windows 主機啟動與 Tunnel 腳本 |
| `src/` | 網站程式 |
| `docs/` | 需求、主機部署 |
| `config/sites.json` | 含 `auth.productionUrl`（主機 HTTPS） |

## 建置

```bash
npm run build
```
