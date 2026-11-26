#Requires -Version 5.1
<#
    Runs the POS admin, and owns the update hand-off.

    The admin exits with code 75 once it has staged an update. A process cannot
    replace the files it is running, so this script is what:

        - starts the server in the foreground and waits for it
        - on exit 75, installs the staged update, then starts again
        - on any other exit, stops (Ctrl+C in the window closes the POS)

    Start POS.bat calls this. Run it by hand if you ever need to watch the log.
#>

$ErrorActionPreference = 'Stop'

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Updater     = Join-Path $PSScriptRoot 'Update-WaterStationPOS.ps1'
$RelFlag     = Join-Path $ProjectRoot 'data\update-relaunch.flag'
$UpdateExit  = 75

Set-Location $ProjectRoot

while ($true) {
    & node admin/server.js
    $code = $LASTEXITCODE

    if ($code -ne $UpdateExit) { exit $code }

    Write-Host ''
    Write-Host '  Installing the downloaded update...' -ForegroundColor Cyan
    & powershell -NoProfile -ExecutionPolicy Bypass -File $Updater
    if ($LASTEXITCODE -ne 0) {
        Write-Host '  The update could not be installed. Starting the current version.' -ForegroundColor Yellow
    }
    Remove-Item $RelFlag -Force -ErrorAction SilentlyContinue

    Write-Host ''
    Write-Host '  Starting the updated POS...' -ForegroundColor Cyan
    Start-Sleep -Seconds 2
}
