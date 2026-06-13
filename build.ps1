# PowerShell script to run the WC2026 server via ".\build Run" command
param(
    [string]$Action
)

if ($Action -eq "Run" -or $Action -eq "run") {
    Write-Host "===================================================" -ForegroundColor Cyan
    Write-Host "Starting WC2026 Proxy Server on http://127.0.0.1:8080" -ForegroundColor Magenta
    Write-Host "===================================================" -ForegroundColor Cyan
    python server.py
} else {
    Write-Host ""
    Write-Host "WC2026 Automation Build Tool" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Usage:"
    Write-Host "  .\build Run    - Starts the local Python web server and proxy"
    Write-Host ""
    if ($Action) {
        Write-Host "(You typed: .\build $Action)" -ForegroundColor Gray
    }
}
