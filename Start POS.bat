@echo off
setlocal EnableExtensions
title Water Station POS
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo   Node.js was not found on this PC.
    echo   Please run "Install.bat" first, then try again.
    echo.
    pause
    exit /b 1
)

REM Only start the server if it is not already listening on the admin port.
netstat -ano | findstr /C:"127.0.0.1:3000" >nul 2>&1
if errorlevel 1 (
    echo Starting the Water Station POS server...
    start "Water Station POS server" /min cmd /k "npm run admin"
    echo Waiting for it to come up...
    timeout /t 7 /nobreak >nul
) else (
    echo The Water Station POS server is already running.
)

start "" "http://127.0.0.1:3000"
exit /b 0
