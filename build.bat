@echo off
:: Batch script to run the WC2026 server via "build Run" command

if /i "%~1"=="Run" (
    echo ===================================================
    echo Starting WC2026 Proxy Server on http://127.0.0.1:8080
    echo ===================================================
    python server.py
) else (
    echo.
    echo WC2026 Automation Build Tool
    echo.
    echo Usage:
    echo   build Run    - Starts the local Python web server and proxy
    echo.
    echo (You typed: build %*)
)
