#!/bin/sh
# Restart the harness's dev server (Vite doesn't watch ../src, which is outside its root).
cd "$(dirname "$0")"
pkill -f "vite --port 5173" 2>/dev/null
sleep 1
nohup npx vite --port 5173 --force > /tmp/claude-0/vite.log 2>&1 &
sleep 4
