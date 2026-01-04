#!/bin/bash

# Coze 知识库管理系统 - 生产部署脚本
# 用法: ./scripts/deploy.sh [port]
# 示例: ./scripts/deploy.sh 3000

set -e

# 默认端口
PORT=${1:-3000}

echo "🚀 开始部署 Coze 知识库管理系统..."
echo ""

# 获取脚本所在目录的父目录（项目根目录）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"
echo "📁 项目目录: $PROJECT_DIR"
echo "🔌 部署端口: $PORT"
echo ""

# 检查配置文件
if [ ! -f "server/.env" ]; then
    echo "❌ 错误: 未找到配置文件 server/.env"
    echo "   请先运行 ./scripts/install.sh 并配置环境变量"
    exit 1
fi

# 检查依赖是否安装
if [ ! -d "node_modules" ] || [ ! -d "server/node_modules" ] || [ ! -d "client/node_modules" ]; then
    echo "⚠️  检测到依赖未安装，正在安装..."
    ./scripts/install.sh
fi

# 构建前端
echo "🔨 构建前端..."
cd client
npm run build

# 检查构建结果
if [ ! -d "dist" ]; then
    echo "❌ 错误: 前端构建失败"
    exit 1
fi

echo "✅ 前端构建完成"
echo ""

cd "$PROJECT_DIR"

# 创建生产服务器文件
echo "📝 创建生产服务器..."
cat > server/dist/production.js << 'EOF'
const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 3000;
const API_PORT = process.env.API_PORT || 3001;

// API 代理
app.use('/api', createProxyMiddleware({
  target: `http://localhost:${API_PORT}`,
  changeOrigin: true
}));

// 静态文件服务
app.use(express.static(path.join(__dirname, '../../client/dist')));

// SPA 路由支持 - 所有非 API 请求返回 index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 生产服务器运行在 http://localhost:${PORT}`);
  console.log(`📡 API 代理到 http://localhost:${API_PORT}`);
});
EOF

# 安装生产服务器依赖
cd server
npm install express http-proxy-middleware --save 2>/dev/null || true

# 构建后端
echo "🔨 构建后端..."
npm run build 2>/dev/null || echo "⚠️  后端使用 tsx 运行，跳过构建"

cd "$PROJECT_DIR"

# 创建启动脚本
echo "📝 创建启动脚本..."
cat > start-production.sh << EOF
#!/bin/bash
# 生产环境启动脚本

cd "\$(dirname "\$0")"

# 启动 API 服务器
echo "🚀 启动 API 服务器..."
cd server
PORT=3001 npx tsx src/index.ts &
API_PID=\$!
cd ..

# 等待 API 服务器启动
sleep 2

# 启动生产服务器
echo "🚀 启动生产服务器..."
cd server
PORT=$PORT API_PORT=3001 node dist/production.js &
WEB_PID=\$!
cd ..

echo ""
echo "=========================================="
echo "✅ 服务已启动！"
echo "=========================================="
echo ""
echo "🌐 访问地址: http://localhost:$PORT/{知识库ID}"
echo "📡 API 地址: http://localhost:3001"
echo ""
echo "进程 ID:"
echo "  API 服务器: \$API_PID"
echo "  Web 服务器: \$WEB_PID"
echo ""
echo "停止服务: kill \$API_PID \$WEB_PID"
echo ""

# 等待进程
wait
EOF

chmod +x start-production.sh

# 创建 PM2 配置文件（可选）
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'coze-api',
      cwd: './server',
      script: 'npx',
      args: 'tsx src/index.ts',
      env: {
        PORT: 3001
      }
    },
    {
      name: 'coze-web',
      cwd: './server',
      script: 'node',
      args: 'dist/production.js',
      env: {
        PORT: 3000,
        API_PORT: 3001
      }
    }
  ]
};
EOF

echo ""
echo "=========================================="
echo "✅ 部署准备完成！"
echo "=========================================="
echo ""
echo "启动方式："
echo ""
echo "  方式一 - 直接启动:"
echo "    ./start-production.sh"
echo ""
echo "  方式二 - 使用 PM2 (推荐生产环境):"
echo "    npm install -g pm2"
echo "    pm2 start ecosystem.config.js"
echo "    pm2 save"
echo ""
echo "访问地址: http://localhost:$PORT/{知识库ID}"
echo ""

