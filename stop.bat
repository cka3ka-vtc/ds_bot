@echo off
chcp 65001 >nul
title BotPanel - Остановка
cd /d "%~dp0"

REM Читаем порт из .env или берём 4000
set APP_PORT=4000
if exist ".env" (
    for /f "tokens=1,2 delims==" %%a in ('findstr /B "PORT=" .env') do (
        if not "%%b"=="" set APP_PORT=%%b
    )
)

echo ============================================================
echo   Остановка процессов на порту %APP_PORT%
echo ============================================================
echo.

set FOUND=0
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%APP_PORT% " ^| findstr "LISTENING"') do (
    echo Убиваю PID %%p...
    taskkill /PID %%p /F >nul 2>nul
    set FOUND=1
)

if "%FOUND%"=="1" (
    echo.
    echo [OK] Все процессы остановлены.
) else (
    echo [ИНФО] На порту %APP_PORT% ничего не запущено.
)

echo.
timeout /t 2 /nobreak >nul
exit /b 0