@echo off
setlocal EnableExtensions
title Water Station POS - Reset owner password
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

echo.
echo   Use this if you cannot sign in to the Point of Sale.
echo   It changes the owner password and shows you the new one.
echo.

node scripts\reset-password.js

echo.
pause
