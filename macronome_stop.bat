@echo off
REM ============================================================================
REM  Macronome - stop the local app (started by macronome_start.bat).
REM  Kills the API + Web windows and stops the dev DB. Your data is KEPT
REM  (the devdata volume survives); relaunch with macronome_start.bat.
REM ============================================================================
setlocal
cd /d "%~dp0"

echo [Macronome] Stopping the API and Web dev servers...
taskkill /FI "WINDOWTITLE eq Macronome API*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Macronome Web*" /T /F >nul 2>&1

echo [Macronome] Stopping the dev database (data kept)...
docker compose -f compose.dev.yml -p macronome-dev down

echo.
echo [Macronome] Stopped. Your data is preserved.
echo            Relaunch with: macronome_start.bat
exit /b 0
