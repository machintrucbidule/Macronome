@echo off
REM ============================================================================
REM  Macronome - stop the test server (removes the compose.test.yml Postgres).
REM  The test DB uses tmpfs, so its data is ephemeral and wiped on stop anyway.
REM ============================================================================
setlocal
cd /d "%~dp0"

echo [Macronome] Stopping the test Postgres...
docker compose -f compose.test.yml down
if errorlevel 1 (
  echo [Macronome] Failed to stop the container ^(maybe it was not running^).
  exit /b 1
)

echo [Macronome] Test DB stopped.
exit /b 0
