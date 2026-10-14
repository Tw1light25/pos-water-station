@echo off
setlocal EnableExtensions
title Water Station POS - Installer

REM Always work from the folder this file lives in, wherever it was unzipped.
cd /d "%~dp0"

REM Installing Node.js needs administrator rights. If we are not elevated,
REM relaunch this same script through a Windows UAC prompt.
fltmc >nul 2>&1
if errorlevel 1 (
    echo.
    echo   Administrator rights are needed to install Node.js.
    echo   A Windows prompt will appear - please choose "Yes".
    echo.
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\Install-WaterStationPOS.ps1"

echo.
pause
