@echo off
setlocal ENABLEEXTENSIONS

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

set "API_PORT=8765"
set "WEB_PORT=8766"
set "API_URL=http://127.0.0.1:%API_PORT%/api/overview"
set "SIM_URL=http://127.0.0.1:%WEB_PORT%/simulation.html"
set "API_REUSE=0"
set "WEB_REUSE=0"

echo ==================================================
echo NCO Local Simulator Launcher
echo Root: %ROOT%
echo API : %API_URL%
echo Web : %SIM_URL%
echo ==================================================

where python >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Python not found in PATH.
  echo Install Python and run this file again.
  exit /b 1
)

call :probe_url "%API_URL%"
if errorlevel 1 (
  call :check_port %API_PORT% API
  if errorlevel 1 exit /b 1
) else (
  set "API_REUSE=1"
  echo [INFO] Reusing existing API server on port %API_PORT%.
)

call :probe_url "%SIM_URL%"
if errorlevel 1 (
  call :check_port %WEB_PORT% WEB
  if errorlevel 1 exit /b 1
) else (
  set "WEB_REUSE=1"
  echo [INFO] Reusing existing web server on port %WEB_PORT%.
)

echo [INFO] Checking Python packages...
python -c "import fastapi, uvicorn, pandas, pydantic, playwright" >nul 2>&1
if errorlevel 1 (
  echo [INFO] Installing required packages for local simulator...
  python -m pip install fastapi uvicorn pandas pydantic playwright
  if errorlevel 1 (
    echo [ERROR] Package installation failed.
    exit /b 1
  )
)

echo [INFO] Preparing local SQLite databases...
pushd "%ROOT%"
python -c "from API.mock_store import build_db; from API.pp_store import build_pp_schema; from API.amphur_population_store import build_amphur_population_schema; from API.hdc_population_store import build_hdc_population_schema; from API.hospital_scope_store import build_scope_schema; build_db(); build_pp_schema(); build_amphur_population_schema(); build_hdc_population_schema(); build_scope_schema()"
if errorlevel 1 (
  popd
  echo [ERROR] Unable to initialize local databases.
  exit /b 1
)

if "%API_REUSE%"=="0" (
  echo [INFO] Starting API server...
  start "NCO API Server" cmd /k "cd /d "%ROOT%" && python -m uvicorn API.main:app --host 127.0.0.1 --port %API_PORT%"
) else (
  echo [INFO] API server already available.
)

if "%WEB_REUSE%"=="0" (
  echo [INFO] Starting static web server...
  start "NCO Web Server" cmd /k "cd /d "%ROOT%" && python -m http.server %WEB_PORT% --bind 127.0.0.1"
) else (
  echo [INFO] Web server already available.
)

echo [INFO] Waiting for servers...
timeout /t 3 /nobreak >nul

echo [INFO] Opening browser...
start "" "%SIM_URL%"

echo.
echo Local simulator is starting.
echo - API window title : NCO API Server
echo - Web window title : NCO Web Server
echo - Close those windows to stop the local system.
echo.
popd
exit /b 0

:probe_url
powershell -NoProfile -Command "try { $resp = Invoke-WebRequest -Uri '%~1' -UseBasicParsing -TimeoutSec 2; if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
exit /b %errorlevel%

:check_port
set "PORT=%~1"
set "LABEL=%~2"
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
  echo [ERROR] %LABEL% port %PORT% is already in use by PID %%P.
  echo Close that process first, then run run_simulator.bat again.
  exit /b 1
)
exit /b 0
