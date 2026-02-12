#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT="${PORT:-3001}"

echo "========================================="
echo "  🚀 Knowledge Graph Explorer 部署脚本"
echo "========================================="
echo ""

# 1. 停止已有服务
echo "🔄 [1/5] 停止现有服务..."
lsof -ti:${PORT} 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1
echo "   ✅ 已停止"

# 2. 安装依赖
echo ""
echo "📦 [2/5] 安装依赖..."
cd "$PROJECT_DIR"
npm install --silent
cd "$PROJECT_DIR/server" && npm install --silent
cd "$PROJECT_DIR/client" && npm install --silent
echo "   ✅ 依赖安装完成"

# 3. 构建前端
echo ""
echo "🏗️  [3/5] 构建前端..."
cd "$PROJECT_DIR/client"
npm run build
echo "   ✅ 前端构建完成 -> client/dist/"

# 4. 构建后端
echo ""
echo "🏗️  [4/5] 构建后端..."
cd "$PROJECT_DIR/server"
npm run build
echo "   ✅ 后端构建完成 -> server/dist/"

# 5. 启动生产服务
echo ""
echo "🚀 [5/5] 启动生产服务..."
cd "$PROJECT_DIR/server"
nohup node dist/index.js > "$PROJECT_DIR/server.log" 2>&1 &
SERVER_PID=$!
sleep 2

# 检查是否启动成功
if kill -0 $SERVER_PID 2>/dev/null; then
  echo "   ✅ 服务已启动 (PID: $SERVER_PID)"
  echo ""
  echo "========================================="
  echo "  ✨ 部署成功！"
  echo "  📍 访问地址: http://localhost:${PORT}"
  echo "  📝 日志文件: $PROJECT_DIR/server.log"
  echo "  🛑 停止服务: kill $SERVER_PID"
  echo "========================================="
else
  echo "   ❌ 启动失败，请查看日志："
  cat "$PROJECT_DIR/server.log"
  exit 1
fi
