@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo   Ckaзka Dev - launcher
echo ============================================

REM ---- Шаг 1: установка зависимостей (если нет node_modules) ----
if not exist "node_modules\" (
    echo [1/2] Installing dependencies...
    call npm install
    if errorlevel 1 goto :error
) else (
    echo [1/2] Dependencies present, skipping.
)

REM ---- Шаг 2: запуск бота ----
echo [2/2] Starting bot...
node server.js
if errorlevel 1 goto :error
goto :eof

:error
echo.
echo [ERROR] Something went wrong. See messages above.
pause
exit /b 1