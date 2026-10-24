@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo  Nexus Bot - запуск
echo ========================================
echo.

echo [1/5] Проверка Node.js...
where node >nul 2>nul
if errorlevel 1 (
    echo [ОШИБКА] Node.js не найден в PATH.
    echo Скачайте и установите: https://nodejs.org/ (LTS^)
    goto end
)
for /f "tokens=*" %%v in ('node -v') do echo   Node.js: %%v

echo.
echo [2/5] Проверка файлов проекта...
if not exist "package.json" (
    echo [ОШИБКА] package.json не найден в %CD%
    goto end
)
if not exist "server.js" (
    echo [ОШИБКА] server.js не найден в %CD%
    goto end
)
if not exist "config.json" (
    echo [ОШИБКА] config.json не найден.
    echo Создайте config.json:
    echo   {"token":"ВАШ_ТОКЕН","port":3000}
    goto end
)
echo   Все файлы на месте.

echo.
echo [3/5] Проверка токена...
findstr /C:"ВАШ_ТОКЕН" config.json >nul
if not errorlevel 1 (
    echo [ОШИБКА] Вставьте реальный токен бота в config.json
    goto end
)
echo   Токен задан.

echo.
echo [4/5] Проверка зависимостей...
if not exist "node_modules" (
    echo   Устанавливаю зависимости (первый запуск может занять минуту^)...
    call npm install
    if errorlevel 1 (
        echo [ОШИБКА] npm install завершился с ошибкой
        goto end
    )
)
echo   Зависимости готовы.

echo.
echo [5/5] Запуск бота...
echo ----------------------------------------
call npm start
echo ----------------------------------------
echo.
echo Бот остановлен.

:end
echo.
pause