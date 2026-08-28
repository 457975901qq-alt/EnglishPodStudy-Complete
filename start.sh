#!/usr/bin/env bash
# EnglishPod 一键启动脚本 (Linux / macOS)
#
# 默认: 安装依赖 -> 构建前端 -> 单端口启动 (API 同时托管前端)
# 开发模式 (--dev): 同时启动 API 与 Vite 热更新开发服务
#
# 用法:
#   ./start.sh              # 生产模式, 单端口 (默认 4173)
#   ./start.sh --dev        # 开发模式, 热更新 (web 默认 5173)
#   PORT=8080 ./start.sh    # 指定端口
set -euo pipefail

cd "$(dirname "$0")"

DEV=false
for arg in "$@"; do
  case "$arg" in
    --dev|-d) DEV=true ;;
    *) echo "未知参数: $arg"; exit 1 ;;
  esac
done

# 检查 Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "错误: 未检测到 Node.js, 请先安装 Node.js 20+ : https://nodejs.org" >&2
  exit 1
fi

# 安装依赖
if [ ! -d node_modules ]; then
  echo "==> 安装依赖 (npm ci) ..."
  npm ci
fi

if [ "$DEV" = true ]; then
  echo "==> 开发模式启动 (热更新) ..."
  echo "    API: http://localhost:4173  Web: http://localhost:5173"
  exec npm run dev
else
  echo "==> 构建前端 (npm run build:web) ..."
  npm run build:web
  export PORT="${PORT:-4173}"
  echo "==> 启动服务: http://localhost:${PORT}"
  exec npm run start
fi
