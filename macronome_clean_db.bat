@echo off
REM ============================================================================
REM  Macronome - WIPE the local dev database (start over from the setup wizard).
REM  Deletes the devdata volume. Asks for confirmation first.
REM ============================================================================
setlocal
cd /d "%~dp0"

echo [Macronome] WARNING: this DELETES all local Macronome data.
echo            You will restart from the first-run setup wizard.
set /p "ans=Type YES to confirm: "
if /i not "%ans%"=="YES" (
  echo [Macronome] Cancelled. Nothing was deleted.
  exit /b 0
)

echo [Macronome] Stopping the dev servers if running...
taskkill /FI "WINDOWTITLE eq Macronome API*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Macronome Web*" /T /F >nul 2>&1

echo [Macronome] Removing the dev database volume...
docker compose -f compose.dev.yml -p macronome-dev down -v

echo.
echo [Macronome] Done. The next macronome_start.bat will be a fresh setup wizard.
exit /b 0
