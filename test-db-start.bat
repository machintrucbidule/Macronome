@echo off
REM ============================================================================
REM  Macronome - start the test server (Postgres via compose.test.yml).
REM  This is the prerequisite for running the test suites. The API and Web dev
REM  servers are NOT started here: the e2e suite boots them itself, and the
REM  authenticated screens are not browsable until the login flow is built.
REM ============================================================================
setlocal
cd /d "%~dp0"

echo [Macronome] Starting the test Postgres (compose.test.yml)...
call npm run db:dev
if errorlevel 1 (
  echo [Macronome] Failed to start Docker Postgres. Is Docker Desktop running?
  exit /b 1
)

echo [Macronome] Waiting for Postgres to accept connections...
set /a tries=0
:waitloop
docker compose -f compose.test.yml exec -T postgres-test pg_isready -U macronome -d macronome_test >nul 2>&1
if not errorlevel 1 goto ready
set /a tries+=1
if %tries% geq 30 (
  echo [Macronome] Postgres did not become ready in time.
  exit /b 1
)
ping -n 2 127.0.0.1 >nul
goto waitloop

:ready
echo [Macronome] Applying migrations...
call npm run migrate
if errorlevel 1 (
  echo [Macronome] Migration failed.
  exit /b 1
)

echo.
echo [Macronome] Test DB is UP and migrated  ^(localhost:5433/macronome_test^).
echo            Run the checks with:  verify.bat
echo            Stop the server with: test-db-stop.bat
exit /b 0
