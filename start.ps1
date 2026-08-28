<#
.SYNOPSIS
  EnglishPod 一键启动脚本 (Windows PowerShell)

.DESCRIPTION
  默认: 安装依赖 -> 构建前端 -> 单端口启动 (API 同时托管前端), 打开 http://localhost:<port>
  开发模式 (-Dev): 同时启动 API 与 Vite 热更新开发服务

.PARAMETER Dev
  使用开发模式 (热更新), 前端默认 http://localhost:5173

.PARAMETER Port
  服务端口 (生产模式生效, 默认 4173)

.EXAMPLE
  ./start.ps1            # 生产模式, 单端口
  ./start.ps1 -Dev       # 开发模式, 热更新
  ./start.ps1 -Port 8080 # 指定端口
#>
param(
  [switch]$Dev,
  [int]$Port = 4173
)

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

# 检查 Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error 'Node.js 未安装, 请先安装 Node.js 20+ : https://nodejs.org'
  exit 1
}

# 安装依赖 (无 node_modules 时)
if (-not (Test-Path 'node_modules')) {
  Write-Host '==> 安装依赖 (npm ci) ...' -ForegroundColor Cyan
  npm ci
}

if ($Dev) {
  Write-Host '==> 开发模式启动 (热更新) ...' -ForegroundColor Cyan
  Write-Host '    API: http://localhost:4173  Web: http://localhost:5173' -ForegroundColor Green
  npm run dev
}
else {
  Write-Host '==> 构建前端 (npm run build:web) ...' -ForegroundColor Cyan
  npm run build:web
  $env:PORT = "$Port"
  Write-Host "==> 启动服务: http://localhost:$Port" -ForegroundColor Green
  npm run start
}
