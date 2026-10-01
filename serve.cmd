@echo off
rem Start a local server for Roll for Glory and open it in your browser.
cd /d "%~dp0"
set PORT=8000
echo Roll for Glory - http://localhost:%PORT%  (close this window to stop)
start "" http://localhost:%PORT%
where py >nul 2>nul && (py -m http.server %PORT%) || (python -m http.server %PORT%)
