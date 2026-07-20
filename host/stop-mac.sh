#!/usr/bin/env bash
# 停止 one-command-mac 啟動的 Auth／Tunnel
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$ROOT/host/.run"
PORT="${PORT:-8788}"

echo "→ 停止 Tunnel／Auth…"
if [[ -f "$LOG_DIR/tunnel.pid" ]]; then
  kill "$(cat "$LOG_DIR/tunnel.pid")" 2>/dev/null || true
  rm -f "$LOG_DIR/tunnel.pid"
fi
if [[ -f "$LOG_DIR/auth.pid" ]]; then
  kill "$(cat "$LOG_DIR/auth.pid")" 2>/dev/null || true
  rm -f "$LOG_DIR/auth.pid"
fi
if lsof -tiTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  kill $(lsof -tiTCP:"$PORT" -sTCP:LISTEN) 2>/dev/null || true
fi
pkill -f "cloudflared tunnel --url http://127.0.0.1:${PORT}" 2>/dev/null || true
echo "✓ 已停止"
