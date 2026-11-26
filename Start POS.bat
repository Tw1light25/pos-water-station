@echo off
setlocal EnableExtensions
title Water Station POS

where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo   Node.js was not found on this PC.
    echo   Please run "Install.bat" first, then try again.
    echo.
    pause
    exit /b 1
)

REM Already running? Just open the browser and leave it alone.
netstat -ano | findstr /C:"127.0.0.1:3000" >nul 2>&1
if not errorlevel 1 (
    echo The Water Station POS server is already running.
    start "" "http://127.0.0.1:3000"
    exit /b 0
)

REM The server runs inside the launcher so an update can be installed and the
REM POS restarted without the shop touching anything. Closing this window
REM stops the POS.
start "Water Station POS server" /min cmd /c "powershell -NoProfile -ExecutionPolicy Bypass -File ""%~dp0windows\Run-WaterStationPOS.ps1"""

echo Waiting for the server to come up...
timeout /t 7 /nobreak >nul

start "" "http://127.0.0.1:3000"
exit /b 0
