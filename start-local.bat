@echo off
chcp 65001 >nul
title Ozon RFBS Calculator - 本地部署

echo.
echo ========================================
echo   Ozon RFBS Calculator 本地部署工具
echo ========================================
echo.

:: 检查 Node.js 是否安装
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js
    echo 下载地址: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: 显示 Node.js 版本
for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo [✓] Node.js 版本: %NODE_VERSION%

:: 检查 npm 是否安装
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 npm
    pause
    exit /b 1
)

:: 显示 npm 版本
for /f "tokens=*" %%i in ('npm -v') do set NPM_VERSION=%%i
echo [✓] npm 版本: %NPM_VERSION%
echo.

:: 进入项目目录
cd /d "%~dp0"
echo [信息] 工作目录: %cd%
echo.

:: 检查 node_modules 是否存在
if not exist "node_modules\" (
    echo [信息] 首次运行，正在安装依赖...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo [错误] 依赖安装失败
        pause
        exit /b 1
    )
    echo.
    echo [✓] 依赖安装完成
    echo.
)

:: 启动开发服务器
echo [信息] 启动开发服务器...
echo.
echo ========================================
echo   服务启动后，浏览器将自动打开
echo   访问地址: http://localhost:3000
echo   按 Ctrl+C 可停止服务
echo ========================================
echo.

:: 延迟 2 秒后打开浏览器
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3000"

:: 启动 Next.js 开发服务器
call npm run dev

pause
