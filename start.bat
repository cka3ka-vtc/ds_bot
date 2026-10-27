@echo off
chcp 65001 >nul
title BotPanel - Запуск
setlocal EnableExtensions
cd /d "%~dp0"

REM ═══════════════════════════════════════════════════════════════
REM  ПОДГОТОВКА ЛОГОВ
REM ═══════════════════════════════════════════════════════════════

set "LOG_DIR=logs"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

REM Имя файла на основе текущего времени (локаль-независимо через PowerShell)
for /f "delims=" %%i in ('powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'"') do set "NOW=%%i"
if "%NOW%"=="" set "NOW=%RANDOM%"

set "LOG_FILE=%LOG_DIR%\botpanel_%NOW%.log"
set "CRASH_FILE=%LOG_DIR%\last_crash.log"

REM Шапка лога (пишется до старта Node)
(
  echo ============================================================
  echo BotPanel - session log
  echo ============================================================
  echo Started:   %NOW%
  echo Host:      %COMPUTERNAME%
  echo User:      %USERNAME%
  echo Directory: %CD%
  echo Node:      & node --version 2^>nul
  echo ============================================================
  echo.
) > "%LOG_FILE%"

echo ============================================================
echo   BotPanel - запуск
echo   Лог: %LOG_FILE%
echo ============================================================
echo.

REM ═══════════════════════════════════════════════════════════════
REM  1. ПРОВЕРКА NODE.JS
REM ═══════════════════════════════════════════════════════════════

where node >nul 2>nul
if errorlevel 1 (
    set "FAIL_MSG=Node.js не найден в PATH. Установите Node.js 20+: https://nodejs.org/"
    goto :fatal
)

for /f "tokens=*" %%i in ('node --version') do set "NODE_VER=%%i"
echo [OK] Node.js: %NODE_VER%

REM ═══════════════════════════════════════════════════════════════
REM  2. ПРОВЕРКА .env
REM ═══════════════════════════════════════════════════════════════

if not exist ".env" (
    if not exist ".env.example" (
        set "FAIL_MSG=Не найден .env и .env.example. Запустите start.bat из корня проекта."
        goto :fatal
    )
    copy ".env.example" ".env" >nul
    start notepad .env
    set "FAIL_MSG=Файл .env создан, но не заполнен. Заполните его и перезапустите start.bat."
    goto :fatal
)
echo [OK] .env найден

call :check_var DISCORD_CLIENT_ID
if errorlevel 1 (
    set "FAIL_MSG=В .env не задан DISCORD_CLIENT_ID"
    goto :fatal
)
call :check_var DISCORD_CLIENT_SECRET
if errorlevel 1 (
    set "FAIL_MSG=В .env не задан DISCORD_CLIENT_SECRET"
    goto :fatal
)
call :check_var DISCORD_MAIN_BOT_TOKEN
if errorlevel 1 (
    set "FAIL_MSG=В .env не задан DISCORD_MAIN_BOT_TOKEN"
    goto :fatal
)
call :check_var JWT_SECRET
if errorlevel 1 (
    set "FAIL_MSG=В .env не задан JWT_SECRET (сгенерируйте: npm run gen-secrets)"
    goto :fatal
)
call :check_var ENCRYPTION_KEY
if errorlevel 1 (
    set "FAIL_MSG=В .env не задан ENCRYPTION_KEY (сгенерируйте: npm run gen-secrets)"
    goto :fatal
)
echo [OK] Переменные .env заполнены

REM ═══════════════════════════════════════════════════════════════
REM  3. ПОРТ
REM ═══════════════════════════════════════════════════════════════

set "APP_PORT=4000"
for /f "tokens=1,2 delims==" %%a in ('findstr /B "PORT=" .env 2^>nul') do (
    if not "%%b"=="" set "APP_PORT=%%b"
)

netstat -ano | findstr ":%APP_PORT% " | findstr "LISTENING" >nul
if not errorlevel 1 (
    echo.
    echo [ВНИМАНИЕ] Порт %APP_PORT% уже занят:
    echo.
    for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%APP_PORT% " ^| findstr "LISTENING"') do (
        echo   PID %%p
        tasklist /FI "PID eq %%p" /FO LIST 2^>nul | findstr /C:"Image:"
    )
    set "FAIL_MSG=Порт %APP_PORT% занят. Запустите stop.bat или смените PORT в .env"
    goto :fatal
)
echo [OK] Порт %APP_PORT% свободен

REM ═══════════════════════════════════════════════════════════════
REM  4. ЗАВИСИМОСТИ
REM ═══════════════════════════════════════════════════════════════

if not exist "node_modules" (
    echo.
    echo [ИНФО] Первый запуск - устанавливаю зависимости...
    call npm install
    if errorlevel 1 (
        set "FAIL_MSG=npm install завершился с ошибкой. Проверьте интернет и версию Node.js."
        goto :fatal
    )
    echo [OK] Зависимости установлены
)

if not exist "data" mkdir data

REM ═══════════════════════════════════════════════════════════════
REM  5. ЗАПУСК
REM ═══════════════════════════════════════════════════════════════

echo.
echo ============================================================
echo   Запуск сервера на http://localhost:%APP_PORT%
echo ============================================================
echo.

REM Открываем браузер через ~3 секунды (пока стартует сервер)
start /b cmd /c "ping -n 4 127.0.0.1 >nul & start http://localhost:%APP_PORT%"

REM ── Запуск с tee: вывод одновременно в консоль и в лог-файл
REM    -Append дописывает в существующий файл (там уже шапка)
REM    exit $LASTEXITCODE пробрасывает код выхода node
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "node server/index.js 2>&1 | Tee-Object -FilePath '%LOG_FILE%' -Append; exit $LASTEXITCODE"

set "EXITCODE=%ERRORLEVEL%"

REM ═══════════════════════════════════════════════════════════════
REM  6. ИТОГ
REM ═══════════════════════════════════════════════════════════════

echo.
echo ============================================================

if "%EXITCODE%"=="0" (
    echo   Сервер остановлен нормально ^(код 0^)
    goto :end
)

echo   [ОШИБКА] Сервер завершился с кодом %EXITCODE%
echo.
copy /Y "%LOG_FILE%" "%CRASH_FILE%" >nul 2>&1
if exist "%CRASH_FILE%" (
    echo   Копия лога для диагностики:
    echo   %CRASH_FILE%
)

echo.
echo ── Последние 40 строк лога ──────────────────────────────────
powershell -NoProfile -Command "if (Test-Path '%LOG_FILE%') { Get-Content '%LOG_FILE%' -Tail 40 } else { 'Лог пуст' }"
echo ─────────────────────────────────────────────────────────────

:end
echo.
echo   Полный лог: %LOG_FILE%
echo   Все логи:   %CD%\%LOG_DIR%\
echo ============================================================
echo.

echo Нажмите любую клавишу для выхода...
pause >nul
endlocal
exit /b %EXITCODE%

REM ═══════════════════════════════════════════════════════════════
REM  ПОДПРОГРАММЫ
REM ═══════════════════════════════════════════════════════════════

:check_var
REM Проверяет, что переменная %1 присутствует в .env и не пуста.
REM Возвращает 0 если ОК, 1 если отсутствует/пуста.
set "FOUND=0"
for /f "tokens=1,2 delims==" %%a in ('findstr /B "%1=" .env 2^>nul') do (
    if not "%%b"=="" set "FOUND=1"
)
if "%FOUND%"=="0" exit /b 1
exit /b 0

:fatal
REM Фатальная ошибка — показываем сообщение, лог, pause, выход.
echo.
echo ============================================================
echo   [ОШИБКА]
echo ============================================================
echo.
echo %FAIL_MSG%
echo.
if exist "%LOG_FILE%" (
    >> "%LOG_FILE%" echo [FATAL] %FAIL_MSG%
)
echo Лог: %LOG_FILE%
echo.
echo Нажмите любую клавишу для выхода...
pause >nul
endlocal
exit /b 1