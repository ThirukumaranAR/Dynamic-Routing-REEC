@echo off
title Smart Approval System Launcher
echo ========================================================
echo    Starting Smart Approval System...
echo ========================================================
echo.

echo [1/2] Installing backend dependencies & starting backend...
start cmd /k "cd /d "%~dp0backend" && npm install && npm run dev"

timeout /t 3 /nobreak >nul

echo [2/2] Installing frontend dependencies & starting frontend...
start cmd /k "cd /d "%~dp0frontend" && npm install && npm run dev"

echo.
echo ========================================================
echo Backend running on:  http://localhost:5000
echo Frontend running on: http://localhost:3000
echo Standalone file:     %~dp0standalone-app.html
echo ========================================================
