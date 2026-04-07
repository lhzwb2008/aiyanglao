#!/usr/bin/env bash
# 供 crontab 调用：cd 到项目目录、加载常见 PATH / nvm、执行 npm run sync
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

export PATH="/usr/local/bin:/usr/bin:/bin:${PATH:-}"

# 若使用 nvm 安装 Node，取消下面两行注释
# export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# [[ -s "$NVM_DIR/nvm.sh" ]] && source "$NVM_DIR/nvm.sh"

mkdir -p logs
exec npm run sync >> "$SCRIPT_DIR/logs/sync.log" 2>&1
