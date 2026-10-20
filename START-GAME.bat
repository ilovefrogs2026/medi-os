@echo off
chcp 65001 > NUL
title MEDI-OS game server - keep this window open
cd /d "%~dp0"
where node 1> NUL 2> NUL
if errorlevel 1 (
  echo.
  echo   Node.js is not installed on this computer yet.
  echo   A website will open now: click "Get Node.js", download the
  echo   Windows Installer ^(.msi^), install it, then run START-GAME again.
  echo.
  start https://nodejs.org/
  pause
  exit /b
)
if not exist "cloudflared.exe" (
  echo.
  echo   First time only: downloading Cloudflare's free link tool ^(about 60 MB^)
  echo   so players outside your Wi-Fi can join. Please wait...
  curl -L --fail -o cloudflared.exe https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
  if errorlevel 1 (
    del cloudflared.exe 2> NUL
    echo   Could not download it. The game still works for players on the same Wi-Fi.
  )
)
start "" cmd /c "timeout /t 2 /nobreak > NUL & start http://localhost:3000"
node server.js
echo.
echo   The game stopped. You can close this window.
pause
