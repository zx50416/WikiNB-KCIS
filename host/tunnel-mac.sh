#!/usr/bin/env bash
# 把本機 Auth :8788 暴露成 HTTPS，讓 github.io 能登入並打到這台主機的 Codex
set -euo pipefail

PORT="${PORT:-8788}"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "尚未安裝 cloudflared。"
  echo "Mac 安裝（需你確認）：brew install cloudflared"
  echo "或見：https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/"
  exit 1
fi

echo "=== Cloudflare Quick Tunnel → http://127.0.0.1:${PORT} ==="
echo "請先在另一個終端機執行：./host/start-mac.sh 或 npm run auth"
echo ""
echo "Tunnel 啟動後會顯示 https://xxxx.trycloudflare.com"
echo "接著："
echo "  1) 把該網址寫進 config/sites.json → auth.productionUrl"
echo "  2) 寫進 auth/.env → AUTH_BASE_URL=該網址"
echo "  3) 重啟 Auth，git commit + push（更新 Pages）"
echo "正式長期請改用 Named Tunnel（固定網址），見 docs/HOST_DEPLOY.md"
echo ""

exec cloudflared tunnel --url "http://127.0.0.1:${PORT}"
