@echo off
rem Start a local server for Murda Worth Street Racing and open it in your browser.
cd /d "%~dp0"
set PORT=8000
echo Murda Worth Street Racing - http://localhost:%PORT%  (close this window to stop)
start "" http://localhost:%PORT%
where py >nul 2>nul && (py -m http.server %PORT%) || (python -m http.server %PORT%)
