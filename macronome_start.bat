@echo off
REM ============================================================================
REM  Macronome - start the FULL local app for manual testing (dev hot-reload).
REM  Launches: persistent dev DB (Docker) + API (watch) + Web (Vite), then opens
REM  the browser. Stop with macronome_stop.bat; wipe the DB with
REM  macronome_clean_db.bat. (For the automated test gate use verify.bat instead.)
REM ============================================================================
setlocal
cd /d "%~dp0"

REM Point the dev API/migrate at the PERSISTENT dev DB (port 5434). This env var is
REM inherited by the child processes and takes precedence over packages/api/.env,
REM so the test DB (5433) and verify.bat stay untouched.
set "DATABASE_URL=postgresql://macronome:dev@localhost:5434/macronome"

echo [Macronome] Starting the dev database (persistent)...
docker compose -f compose.dev.yml -p macronome-dev up -d
if errorlevel 1 (
  echo [Macronome] Failed to start Docker. Is Docker Desktop running?
  exit /b 1
)

echo [Macronome] Waiting for the database...
set /a tries=0
:waitdb
docker compose -f compose.dev.yml -p macronome-dev exec -T postgres-dev pg_isready -U macronome -d macronome >nul 2>&1
if not errorlevel 1 goto dbready
set /a tries+=1
if %tries% geq 30 (
  echo [Macronome] Database did not become ready in time.
  exit /b 1
)
ping -n 2 127.0.0.1 >nul
goto waitdb

:dbready
echo [Macronome] Generating Prisma client + applying migrations...
call npm run prisma:generate -w @macronome/api
if errorlevel 1 goto fail
call npm run migrate
if errorlevel 1 goto fail

echo [Macronome] Launching API (hot-reload) and Web (Vite) in separate windows...
start "Macronome API" cmd /k "npm run dev:api"
start "Macronome Web" cmd /k "npm run dev:web"

echo.
echo ============================================================
echo  [Macronome] Dev environment starting.
echo  Open: http://127.0.0.1:5173   (opening automatically)
echo  Two windows opened: "Macronome API" and "Macronome Web".
echo  Stop with:     macronome_stop.bat
echo  Reset the DB:  macronome_clean_db.bat
echo ============================================================
timeout /t 5 >nul
start "" http://127.0.0.1:5173
exit /b 0

:fail
echo [Macronome] Startup failed - see the output above.
exit /b 1
