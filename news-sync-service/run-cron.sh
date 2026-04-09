#!/usr/bin/env bash
# 供 crontab 调用：cd 到项目目录、加载常见 PATH / nvm、执行 npm run sync
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [[ ! -f "$SCRIPT_DIR/.env" ]]; then
  echo "错误: 未找到 $SCRIPT_DIR/.env（.env 被 git 忽略，需手动上传到服务器）。" >&2
  echo "请将本机 news-sync-service/.env 复制到该路径，或 scp / 在服务器上复制 .env.example 为 .env 并填写。" >&2
  exit 1
fi

export PATH="/usr/local/bin:/usr/bin:/bin:${PATH:-}"

# 若使用 nvm 安装 Node，取消下面两行注释
# export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# [[ -s "$NVM_DIR/nvm.sh" ]] && source "$NVM_DIR/nvm.sh"

mkdir -p logs
LOG_FILE="$SCRIPT_DIR/logs/sync.log"
touch "$LOG_FILE"
exec npm run sync >> "$LOG_FILE" 2>&1
