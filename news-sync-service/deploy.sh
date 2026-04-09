#!/usr/bin/env bash
# 在字节云 / 任意 Linux 上部署 news-sync-service：安装依赖，可选写入 crontab
# 同步靠稿件 ID 去重；改频率只改下方 cron 表达式即可（如每小时: 0 * * * *）
#
# 用法:
#   chmod +x deploy.sh
#   ./deploy.sh              # 仅安装依赖、创建 logs 目录
#   ./deploy.sh --with-cron  # 同上 + crontab（默认每天 0:00）
#   ./deploy.sh --with-cron "0 * * * *"   # 每小时整点
#   ./deploy.sh --with-cron "30 2 * * *"  # 每天 2:30
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

CRON_SCHEDULE="${2:-0 0 * * *}"
MARKER="news-sync-incremental"

log() { echo "[deploy] $*"; }

if [[ ! -f .env ]]; then
  echo "错误: 未找到 .env。请先复制 .env.example 为 .env 并填写网关与 Coze 配置。" >&2
  exit 1
fi

log "安装依赖 (npm install)…"
npm install

mkdir -p logs
touch logs/sync.log
chmod +x run-cron.sh 2>/dev/null || true
log "日志文件: $SCRIPT_DIR/logs/sync.log（部署后已创建空文件，首次跑同步后会有内容）"

if [[ "${1:-}" == "--with-cron" ]]; then
  RUNNER="$SCRIPT_DIR/run-cron.sh"
  chmod +x "$RUNNER" 2>/dev/null || true

  CRON_LINE="$CRON_SCHEDULE $(printf '%q' "$RUNNER") # $MARKER"

  # 去掉旧的本项目 cron 行，再追加新行
  ( crontab -l 2>/dev/null | grep -vF "$MARKER" || true
    echo "$CRON_LINE"
  ) | crontab -

  log "已写入当前用户的 crontab，调度: $CRON_SCHEDULE"
  echo "---------- crontab ----------"
  crontab -l
  echo "-----------------------------"
else
  log "依赖已就绪。若需每天 0 点自动同步，请执行:"
  log "  $0 --with-cron"
  log "或自定义时间（cron 五段）:"
  log "  $0 --with-cron '0 0 * * *'"
fi
