#!/bin/bash

# Coze 知识库管理系统 - 依赖安装脚本
# 用法: ./scripts/install.sh

set -e

echo "🚀 开始安装 Coze 知识库管理系统依赖..."
echo ""

# 检查 Node.js 是否安装
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未检测到 Node.js，请先安装 Node.js (推荐 v18+)"
    echo "   下载地址: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v)
echo "✅ Node.js 版本: $NODE_VERSION"

# 检查 npm 是否安装
if ! command -v npm &> /dev/null; then
    echo "❌ 错误: 未检测到 npm"
    exit 1
fi

NPM_VERSION=$(npm -v)
echo "✅ npm 版本: $NPM_VERSION"
echo ""

# 获取脚本所在目录的父目录（项目根目录）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"
echo "📁 项目目录: $PROJECT_DIR"
echo ""

# 安装根目录依赖
echo "📦 安装根目录依赖..."
npm install

# 安装服务端依赖
echo ""
echo "📦 安装服务端依赖..."
cd server
npm install

# 安装客户端依赖
echo ""
echo "📦 安装客户端依赖..."
cd ../client
npm install

cd "$PROJECT_DIR"

# 检查配置文件
echo ""
if [ ! -f "server/.env" ]; then
    echo "⚠️  未检测到配置文件，正在创建..."
    cat > server/.env << 'EOF'
# Coze API 配置
# 获取方式: https://www.coze.cn/open/oauth/pats
COZE_API_TOKEN=your_coze_api_token_here

# 工作空间 ID
# 获取方式: 进入 Coze 工作空间，从 URL 中获取
COZE_SPACE_ID=your_space_id_here

# 服务器端口
PORT=3001
EOF
    echo "✅ 配置文件已创建: server/.env"
    echo "⚠️  请编辑 server/.env 文件，填入你的 Coze API Token 和 Space ID"
else
    echo "✅ 配置文件已存在: server/.env"
fi

echo ""
echo "=========================================="
echo "✅ 依赖安装完成！"
echo "=========================================="
echo ""
echo "下一步操作："
echo "  1. 编辑配置文件: vim server/.env"
echo "  2. 启动开发服务: npm run dev"
echo "  3. 访问地址: http://localhost:5173/{知识库ID}"
echo ""

