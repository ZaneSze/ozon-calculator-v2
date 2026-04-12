#!/bin/bash

# Ozon RFBS Calculator - 本地部署工具 (macOS/Linux)

echo ""
echo "========================================"
echo "  Ozon RFBS Calculator 本地部署工具"
echo "========================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查 Node.js 是否安装
if ! command -v node &> /dev/null; then
    echo -e "${RED}[错误]${NC} 未检测到 Node.js，请先安装 Node.js"
    echo "下载地址: https://nodejs.org/"
    echo ""
    exit 1
fi

# 显示 Node.js 版本
NODE_VERSION=$(node -v)
echo -e "${GREEN}[✓]${NC} Node.js 版本: $NODE_VERSION"

# 检查 npm 是否安装
if ! command -v npm &> /dev/null; then
    echo -e "${RED}[错误]${NC} 未检测到 npm"
    exit 1
fi

# 显示 npm 版本
NPM_VERSION=$(npm -v)
echo -e "${GREEN}[✓]${NC} npm 版本: $NPM_VERSION"
echo ""

# 进入脚本所在目录
cd "$(dirname "$0")"
echo "[信息] 工作目录: $(pwd)"
echo ""

# 检查 node_modules 是否存在
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}[信息]${NC} 首次运行，正在安装依赖..."
    echo ""
    npm install
    if [ $? -ne 0 ]; then
        echo ""
        echo -e "${RED}[错误]${NC} 依赖安装失败"
        exit 1
    fi
    echo ""
    echo -e "${GREEN}[✓]${NC} 依赖安装完成"
    echo ""
fi

# 启动开发服务器
echo "[信息] 启动开发服务器..."
echo ""
echo "========================================"
echo "  服务启动后，浏览器将自动打开"
echo "  访问地址: http://localhost:3000"
echo "  按 Ctrl+C 可停止服务"
echo "========================================"
echo ""

# 延迟 2 秒后打开浏览器
sleep 2 && open "http://localhost:3000" 2>/dev/null || xdg-open "http://localhost:3000" 2>/dev/null &

# 启动 Next.js 开发服务器
npm run dev
