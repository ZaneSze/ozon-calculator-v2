@echo off
chcp 65001 >nul
title Ozon RFBS Calculator - 停止服务

echo.
echo ========================================
echo   停止本地开发服务器
echo ========================================
echo.

echo [信息] 正在查找并停止 Node.js 进程...

:: 查找占用 3000 端口的进程
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    echo [信息] 找到进程 PID: %%a
    taskkill /PID %%a /F >nul 2>&1
    if %errorlevel% equ 0 (
        echo [✓] 进程 %%a 已停止
    )
)

echo.
echo [✓] 本地服务已停止
echo.
pause
