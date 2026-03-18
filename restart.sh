#!/bin/bash

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_FILE="$PROJECT_DIR/dev.log"

echo "🔄 正在停止现有服务..."

# 杀掉占用 3001 和 5173 端口的进程
lsof -ti:3001 -ti:5173 2>/dev/null | xargs kill -9 2>/dev/null
sleep 1

echo "🚀 正在后台启动服务..."

cd "$PROJECT_DIR"
nohup npm run dev > "$LOG_FILE" 2>&1 &
PID=$!
sleep 3

# 检查是否启动成功
if kill -0 $PID 2>/dev/null; then
  echo "✅ 服务已在后台启动 (PID: $PID)"
  echo "   访问地址: http://localhost:3001 （前端+后端，部署只需开放此端口）"
  echo "   开发时前端: http://localhost:5173"
  echo "   日志: $LOG_FILE"
  echo "   查看日志: tail -f $LOG_FILE"
  echo "   停止服务: kill $PID 或重新运行 ./restart.sh"
else
  echo "❌ 启动失败，查看日志："
  tail -20 "$LOG_FILE"
  exit 1
fi
