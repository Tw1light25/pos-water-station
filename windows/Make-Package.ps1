#Requires -Version 5.1
<#
    Builds a clean ZIP of the Point of Sale for handing to a client.

    Excludes everything that must not travel:
        node_modules  - the installer runs npm install
        .git          - history is not needed
        hide          - contains the database password and owner login notes
        data          - the admin rebuilds it and pulls from TiDB
        .env          - the installer writes a fresh one with real credentials

    Usage:  right-click > Run with PowerShell,  or
            powershell -ExecutionPolicy Bypass -File windows\Make-Package.ps1
#>

$ErrorActionPreference = 'Stop'

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$stamp       = Get-Date -Format 'yyyy-MM-dd'
$zipName     = "WaterStationPOS-$stamp.zip"
$outZip      = Join-Path ([Environment]::GetFolderPath('Desktop')) $zipName
$stage       = Join-Path $env:TEMP ("pos-package-" + [guid]::NewGuid().ToString('N'))

Write-Host ''
Write-Host '  Packaging the Point of Sale...' -ForegroundColor Cyan
Write-Host "  Source: $ProjectRoot" -ForegroundColor Gray
Write-Host ''

New-Item -ItemType Directory -Path $stage -Force | Out-Null

robocopy $ProjectRoot $stage /E /NFL /NDL /NJH /NJS `
    /XD node_modules .git hide data `
    /XF .env '*.log' | Out-Null

if ($LASTEXITCODE -ge 8) {
    Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
    throw "robocopy failed with exit code $LASTEXITCODE"
}

# Sanity checks - these must never end up in a client package.
foreach ($forbidden in @('hide', 'data', '.env', 'node_modules')) {
    if (Test-Path (Join-Path $stage $forbidden)) {
        Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
        throw "Refusing to package: '$forbidden' was copied into the staging folder."
    }
}

if (-not (Test-Path (Join-Path $stage 'certs\ca.pem'))) {
    Write-Host '  [WARN]  certs\ca.pem was not found - the client will not be able to connect.' -ForegroundColor Yellow
}

if (Test-Path $outZip) { Remove-Item $outZip -Force }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $outZip -CompressionLevel Optimal
Remove-Item $stage -Recurse -Force

Write-Host ''
Write-Host "  Created: $outZip" -ForegroundColor Green
Write-Host ''
Write-Host '  Send that ZIP to the client. They unzip it anywhere and double-click Install.bat.' -ForegroundColor Gray
Write-Host ''
