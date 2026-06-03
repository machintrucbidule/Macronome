@echo off
REM ============================================================================
REM  Macronome - autonomous verification of the current build.
REM  Ensures the test DB is up + migrated, then runs the full gate:
REM  schema check, typecheck, lint, unit, integration, and e2e (the e2e drives a
REM  real browser through create -> search -> archive on the Aliments screen).
REM ============================================================================
setlocal
cd /d "%~dp0"

call "%~dp0test-db-start.bat"
if errorlevel 1 goto fail

echo.
echo === [0/6] generate Prisma client ===
REM Type-aware lint/typecheck need the generated client (same as CI / Docker).
call npm run prisma:generate -w @macronome/api
if errorlevel 1 goto fail

echo.
echo === [1/6] schema check ===
call npm run check:schema
if errorlevel 1 goto fail

echo.
echo === [2/6] typecheck ===
call npm run typecheck
if errorlevel 1 goto fail

echo.
echo === [3/6] lint ===
call npm run lint
if errorlevel 1 goto fail

echo.
echo === [4/6] unit tests ===
call npm test
if errorlevel 1 goto fail

echo.
echo === [5/6] integration tests ===
call npm run test:int
if errorlevel 1 goto fail

echo.
echo === [6/6] end-to-end tests ===
call npm run e2e
if errorlevel 1 goto fail

echo.
echo ============================================================
echo  [Macronome] ALL CHECKS PASSED.
echo ============================================================
exit /b 0

:fail
echo.
echo ============================================================
echo  [Macronome] A CHECK FAILED - see the output above.
echo ============================================================
exit /b 1
