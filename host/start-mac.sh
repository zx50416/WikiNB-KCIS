#!/usr/bin/env bash
# WikiNB KCIS — 在「部署主機」啟動 Auth + Codex（目前：Mac；未來可搬到 Windows）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== WikiNB KCIS Host (Mac) ==="
echo "專案：$ROOT"
echo ""

if [[ ! -f auth/.env ]]; then
  echo "缺少 auth/.env — 請先：cp auth/.env.example auth/.env 並填寫"
  exit 1
fi

# 主機模式：給 Pages 跨站 cookie 用（Tunnel HTTPS 時）
export HOST="${HOST:-127.0.0.1}"
export COOKIE_SAMESITE="${COOKIE_SAMESITE:-none}"
export FRONTEND_ORIGINS="${FRONTEND_ORIGINS:-https://zx50416.github.io}"

echo "1) 啟動 Auth API（連本機 Codex CLI）…"
echo "   另開一個終端機執行 Tunnel（若要用線上站登入）："
echo "   ./host/tunnel-mac.sh"
echo ""

npm run auth
