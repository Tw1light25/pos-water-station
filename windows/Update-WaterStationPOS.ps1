#Requires -Version 5.1
<#
    Installs a staged update, or relaunches the admin after one.

    The admin cannot replace the files it is running, so when the owner clicks
    "Update now" the server exits with code 75. Start POS.bat then calls this
    script, which:

        1. copies data\update-staging\payload over the install folder
           (skipping .env, data, hide, backups, certs, node_modules, .git)
        2. runs npm install for any new dependencies
        3. writes data\update-installing.json so the admin can confirm the change
        4. leaves a marker telling Start POS.bat to launch again

    With -InstallAndOpen it relaunches the app itself, for running by hand.
#>

param(
    [switch]$InstallAndOpen
)

$ErrorActionPreference = 'Stop'

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$DataDir     = Join-Path $ProjectRoot 'data'
$Staging     = Join-Path $DataDir 'update-staging'
$InfoPath    = Join-Path $Staging 'update-info.json'
$Payload     = Join-Path $Staging 'payload'
$RelFlag     = Join-Path $DataDir 'update-relaunch.flag'
$StatePath   = Join-Path $DataDir 'update-state.json'

# Anything that holds the client's credentials or live sales. Never overwritten.
$Protected = @('.env', 'data', 'hide', 'backups', 'certs', 'node_modules', '.git')

function Write-Step($message) {
    Write-Host "  $message" -ForegroundColor Cyan
}

function Write-Fail($message) {
    Write-Host "  $message" -ForegroundColor Red
    Write-Host '  The app files were not changed.' -ForegroundColor Gray
}

if (-not (Test-Path $InfoPath) -or -not (Test-Path $Payload)) {
    if ($InstallAndOpen) { Write-Host '  No update is waiting to install.' -ForegroundColor Gray }
    exit 1
}

$info = Get-Content $InfoPath -Raw | ConvertFrom-Json
$version = $info.version
if (-not $version) {
    Write-Fail 'The staged update has no version. Discarding it.'
    Remove-Item $Staging -Recurse -Force -ErrorAction SilentlyContinue
    exit 1
}

Write-Host ''
Write-Host "  Installing version $version ..." -ForegroundColor Cyan

# 1. Safety net: snapshot the code (not the data) before touching it, so a bad
#    release can be rolled back without the client doing anything clever.
$CodeBackup = Join-Path $DataDir 'update-backup'
Remove-Item $CodeBackup -Recurse -Force -ErrorAction SilentlyContinue
$null = New-Item -ItemType Directory -Path $CodeBackup -Force
Get-ChildItem -LiteralPath $ProjectRoot -Force | Where-Object { $Protected -notcontains $_.Name } | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $CodeBackup -Recurse -Force
}

# 2. Copy the new files in, skipping protected names at the top level.
Write-Step 'Copying new files...'
Get-ChildItem -LiteralPath $Payload -Force | Where-Object { $Protected -notcontains $_.Name } | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $ProjectRoot -Recurse -Force
}

# 3. Install any new dependencies.
Write-Step 'Installing packages...'
$npm = $null
foreach ($name in @('npm.cmd', 'npm')) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if ($cmd) { $npm = $cmd.Source; break }
}
if (-not $npm) {
    $fallback = Join-Path $env:ProgramFiles 'nodejs\npm.cmd'
    if (Test-Path $fallback) { $npm = $fallback }
}

if ($npm) {
    Push-Location $ProjectRoot
    try {
        & $npm install --no-audit --no-fund 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Fail 'npm install failed. Restoring the previous version.'
            Get-ChildItem -LiteralPath $CodeBackup -Force | ForEach-Object {
                Copy-Item -LiteralPath $_.FullName -Destination $ProjectRoot -Recurse -Force
            }
            Remove-Item $Staging -Recurse -Force -ErrorAction SilentlyContinue
            exit 1
        }
    } finally {
        Pop-Location
    }
} else {
    Write-Host '  [WARN] npm was not found - dependencies were not refreshed.' -ForegroundColor Yellow
}

# 4. Tell the admin which version it is now running.
$installed = @{ version = $version; from = $info.from; at = (Get-Date).ToUniversalTime().ToString('o') } |
    ConvertTo-Json -Compress
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $DataDir 'update-installing.json'), $installed, $utf8NoBom)
[System.IO.File]::WriteAllText($StatePath, "{`"status`":`"installed`",`"version`":`"$version`"}", $utf8NoBom)

Remove-Item $Staging -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item $CodeBackup -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "  Version $version is installed." -ForegroundColor Green

if ($InstallAndOpen) {
    $launcher = Join-Path $ProjectRoot 'Start POS.bat'
    if (Test-Path $launcher) { Start-Process -FilePath $launcher }
} else {
    # Start POS.bat reads this and launches the admin again.
    [System.IO.File]::WriteAllText($RelFlag, $version, $utf8NoBom)
}

exit 0
