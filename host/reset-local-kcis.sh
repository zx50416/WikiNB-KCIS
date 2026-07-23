#!/bin/bash
# 關掉卡住的舊 KCIS 網站／Auth，再開乾淨的一組
set -e
cd "$(dirname "$0")/.."

echo "1) 停止舊程序（4322／4323／8788／8790）…"
for p in 4322 4323 8788 8790; do
  PIDS=$(lsof -t -iTCP:$p -sTCP:LISTEN 2>/dev/null || true)
  if [ -n "$PIDS" ]; then
    echo "   kill :$p -> $PIDS"
    # shellcheck disable=SC2086
    kill -9 $PIDS 2>/dev/null || true
  fi
done
sleep 1

echo "2) 啟動 Auth（8790）…"
npm run auth > /tmp/kcis-auth.log 2>&1 &
sleep 2
curl -sf http://127.0.0.1:8790/api/health >/dev/null && echo "   Auth OK" || echo "   Auth 啟動失敗，看 /tmp/kcis-auth.log"

echo "3) 啟動網站（4322）…"
npm run dev > /tmp/kcis-dev.log 2>&1 &
sleep 3
curl -sf -o /dev/null http://127.0.0.1:4322/WikiNB-KCIS/login && echo "   網站 OK" || echo "   網站啟動失敗，看 /tmp/kcis-dev.log"

echo
echo "請開啟： http://127.0.0.1:4322/WikiNB-KCIS/login"
echo "按 Cmd+Shift+R，再試寄送驗證碼。"
echo "驗證碼會印在 Auth 日誌： tail -f /tmp/kcis-auth.log"
