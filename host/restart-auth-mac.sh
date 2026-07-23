#!/bin/bash
# 釋放並重啟 KCIS Auth（預設埠 8790；一併清掉舊的 8788）
set -e
cd "$(dirname "$0")/.."
PORT="${PORT:-8790}"
echo "停止占用 ${PORT}／8788 的舊 Auth…"
for p in "$PORT" 8788; do
  PIDS=$(lsof -t -iTCP:"$p" -sTCP:LISTEN 2>/dev/null || true)
  if [ -n "$PIDS" ]; then
    # shellcheck disable=SC2086
    kill -9 $PIDS 2>/dev/null || true
  fi
done
sleep 1
echo "啟動 Auth（${PORT}）…"
export PORT
exec npm run auth
