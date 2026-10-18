#!/bin/zsh
# Double-click to start LIFE OS and open it in your browser.
cd "$(dirname "$0")"
source ~/.nvm/nvm.sh 2>/dev/null
if lsof -i :3000 -sTCP:LISTEN >/dev/null 2>&1; then
  open http://localhost:3000; exit 0
fi
if [ ! -d node_modules ]; then NODE_ENV=development npm install --include=dev; fi
# Rebuild when there is no build yet, or when any code changed since the last build.
if [ ! -f .next/BUILD_ID ] || [ -n "$(find app components lib -newer .next/BUILD_ID -type f 2>/dev/null | head -1)" ]; then
  echo "Code changed since the last build. Rebuilding (about a minute)..."
  npx next build || { echo "Build failed. Leave this window open and tell Claude."; read; exit 1; }
fi
(sleep 4; open http://localhost:3000) &
echo "LIFE OS running at http://localhost:3000  (close this window to stop it)"
NODE_ENV=production npx next start -p 3000
