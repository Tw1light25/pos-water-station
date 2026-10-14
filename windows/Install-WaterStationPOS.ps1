#Requires -Version 5.1
<#
    Water Station POS - Windows installer
    ------------------------------------------------------------------
      1. Makes sure Node.js 24 LTS is installed
         (winget first, official MSI as a fallback)
      2. Checks the bundled TLS certificate
      3. Asks for the TiDB connection details
      4. Writes .env
      5. Installs the npm packages
      6. Verifies the database connection
      7. Creates a desktop shortcut

    Safe to re-run: an existing .env is never overwritten.
#>

$ErrorActionPreference = 'Stop'

$ProjectRoot   = Split-Path -Parent $PSScriptRoot
$NodeMinimum   = [version]'23.4.0'      # node:sqlite needs >= 23.4
$NodeMsi       = 'v24.21.0'             # exact version used for the fallback
$Banner        = '=' * 64

function Write-Head([string]$Text) {
    Write-Host ''
    Write-Host $Banner -ForegroundColor DarkGray
    Write-Host "  $Text" -ForegroundColor Cyan
    Write-Host $Banner -ForegroundColor DarkGray
}
function Write-Ok([string]$Text)    { Write-Host "  [ OK ]  $Text" -ForegroundColor Green }
function Write-Warn2([string]$Text) { Write-Host "  [WARN]  $Text" -ForegroundColor Yellow }
function Write-Bad([string]$Text)   { Write-Host "  [FAIL]  $Text" -ForegroundColor Red }

function Stop-Install([string]$Text) {
    Write-Bad $Text
    Write-Host ''
    Write-Host '  Installation did not finish. Fix the problem above, then run Install.bat again.' -ForegroundColor Red
    exit 1
}

function Get-NodeVersion {
    $cmd = Get-Command node.exe -ErrorAction SilentlyContinue
    if (-not $cmd) { $cmd = Get-Command node -ErrorAction SilentlyContinue }
    if (-not $cmd) { return $null }
    try {
        $raw = (& $cmd.Source -v) 2>$null
        if (-not $raw) { return $null }
        return [version](($raw -replace '^v', '').Trim())
    } catch {
        return $null
    }
}

function Test-NodeReady {
    $version = Get-NodeVersion
    return ($null -ne $version -and $version -ge $NodeMinimum)
}

function Update-SessionPath {
    $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user    = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = (@($machine, $user) | Where-Object { $_ }) -join ';'
}

function Get-NpmPath {
    foreach ($name in @('npm.cmd', 'npm')) {
        $cmd = Get-Command $name -ErrorAction SilentlyContinue
        if ($cmd) { return $cmd.Source }
    }
    $fallback = Join-Path $env:ProgramFiles 'nodejs\npm.cmd'
    if (Test-Path $fallback) { return $fallback }
    return $null
}

function Install-Node {
    $winget = Get-Command winget -ErrorAction SilentlyContinue

    if ($winget) {
        Write-Host '  Installing Node.js LTS with winget...' -ForegroundColor Gray
        try {
            & winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements
        } catch {
            Write-Warn2 "winget could not install Node.js: $($_.Exception.Message)"
        }
        Update-SessionPath
        if (Test-NodeReady) { return $true }
        Write-Warn2 'winget did not give us a new enough Node.js - using the official installer instead.'
    } else {
        Write-Warn2 'winget is not available on this PC - downloading the installer instead.'
    }

    $url = "https://nodejs.org/dist/$NodeMsi/node-$NodeMsi-x64.msi"
    $msi = Join-Path $env:TEMP "node-$NodeMsi-x64.msi"

    Write-Host "  Downloading $url" -ForegroundColor Gray
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $url -OutFile $msi -UseBasicParsing
    } catch {
        Stop-Install "Could not download Node.js ($($_.Exception.Message)). Install it from https://nodejs.org and run Install.bat again."
    }

    Write-Host '  Installing Node.js (this takes about a minute)...' -ForegroundColor Gray
    $process = Start-Process msiexec.exe -ArgumentList @('/i', "`"$msi`"", '/qn', '/norestart') -Wait -PassThru
    Remove-Item $msi -ErrorAction SilentlyContinue

    if ($process.ExitCode -ne 0 -and $process.ExitCode -ne 3010) {
        Stop-Install "The Node.js installer returned code $($process.ExitCode)."
    }

    Update-SessionPath
    return (Test-NodeReady)
}

function Read-Value([string]$Label, [string]$Default) {
    if ($Default) {
        $answer = Read-Host "  $Label [$Default]"
        if ([string]::IsNullOrWhiteSpace($answer)) { return $Default }
        return $answer.Trim()
    }
    do {
        $answer = Read-Host "  $Label"
    } while ([string]::IsNullOrWhiteSpace($answer))
    return $answer.Trim()
}

# ------------------------------------------------------------------ start

Clear-Host
Write-Head 'Water Station POS - installer'
Write-Host "  Folder: $ProjectRoot" -ForegroundColor Gray

# 1. Node.js ---------------------------------------------------------------
Write-Head '1 of 7 - Node.js'

if (Test-NodeReady) {
    Write-Ok "Node.js $(Get-NodeVersion) is already installed"
} else {
    $current = Get-NodeVersion
    if ($current) {
        Write-Warn2 "Node.js $current is too old (need $NodeMinimum or newer) - installing $NodeMsi"
    } else {
        Write-Host '  Node.js was not found - installing it now.' -ForegroundColor Gray
    }

    if (-not (Install-Node)) {
        Stop-Install 'Node.js could not be installed automatically. Get it from https://nodejs.org and run Install.bat again.'
    }
    Write-Ok "Node.js $(Get-NodeVersion) is ready"
}

# 2. Certificate -----------------------------------------------------------
Write-Head '2 of 7 - TLS certificate'

$certPath = Join-Path $ProjectRoot 'certs\ca.pem'
if (-not (Test-Path $certPath)) {
    Stop-Install 'certs\ca.pem is missing. It has to ship together with the app folder.'
}
Write-Ok 'Found certs\ca.pem (used to reach TiDB securely)'

# 3. Credentials -----------------------------------------------------------
Write-Head '3 of 7 - Database connection'
Write-Host '  Press Enter to accept the value shown in [brackets].' -ForegroundColor Gray
Write-Host ''

$dbHost = Read-Value 'TiDB host' 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com'
$dbPort = Read-Value 'TiDB port' '4000'
$dbUser = Read-Value 'TiDB user (the one ending in .root)' ''
$dbName = Read-Value 'Database name' 'pos-water-station'

$securePassword = Read-Host '  TiDB password' -AsSecureString
$dbPass = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword))
if ([string]::IsNullOrWhiteSpace($dbPass)) {
    Stop-Install 'A database password is required.'
}

# 4. .env ------------------------------------------------------------------
Write-Head '4 of 7 - Configuration file'

$envPath = Join-Path $ProjectRoot '.env'
if (Test-Path $envPath) {
    Write-Warn2 '.env already exists - leaving it untouched (delete it if you want to reconfigure)'
} else {
    $content = @(
        '# Created by Install.bat - this file is private, do not share it.',
        "DB_HOST=$dbHost",
        "DB_PORT=$dbPort",
        "DB_USER=$dbUser",
        "DB_PASS=$dbPass",
        "DB_NAME=$dbName",
        '',
        '# Resolved from this folder, so the app works wherever it is installed.',
        'DB_CA=certs/ca.pem',
        'DB_SSL=true',
        '',
        '# Owner account (only used the very first time the database is created)',
        'OWNER_USERNAME=owner',
        'OWNER_PASSWORD=',
        'BUSINESS_NAME=Water Station',
        'SEED_PRODUCTS=true',
        '',
        '# Local admin server',
        'ADMIN_PORT=3000',
        "SESSION_SECRET=$([guid]::NewGuid().ToString('N'))"
    )
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllLines($envPath, [string[]]$content, $utf8NoBom)
    Write-Ok 'Wrote .env'
}

# 5. Packages --------------------------------------------------------------
Write-Head '5 of 7 - Installing packages'

$npm = Get-NpmPath
if (-not $npm) {
    Stop-Install 'npm was not found after installing Node.js. Restart this PC and run Install.bat again.'
}

Push-Location $ProjectRoot
try {
    & $npm install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) {
        Stop-Install 'npm install failed. Scroll up to see the reason.'
    }
} finally {
    Pop-Location
}
Write-Ok 'Packages installed'

# 6. Database --------------------------------------------------------------
Write-Head '6 of 7 - Checking the database'

Push-Location $ProjectRoot
try {
    & $npm run db:init
    if ($LASTEXITCODE -ne 0) {
        Stop-Install "Could not reach the database. Check the credentials, and make sure this PC is allowed in TiDB > Settings > Networking."
    }
} finally {
    Pop-Location
}

# 7. Shortcut --------------------------------------------------------------
Write-Head '7 of 7 - Desktop shortcut'

try {
    $linkPath = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Water Station POS.lnk'
    $shell = New-Object -ComObject WScript.Shell
    $link = $shell.CreateShortcut($linkPath)
    $link.TargetPath = Join-Path $ProjectRoot 'Start POS.bat'
    $link.WorkingDirectory = $ProjectRoot
    $icon = Join-Path $ProjectRoot 'windows\pos.ico'
    if (Test-Path $icon) { $link.IconLocation = $icon }
    $link.Description = 'Water Station Point of Sale'
    $link.Save()
    Write-Ok "Created 'Water Station POS' on the desktop"
} catch {
    Write-Warn2 "Could not create the shortcut: $($_.Exception.Message)"
}

# ------------------------------------------------------------------ done

Write-Head 'Finished'
Write-Host '  The Point of Sale is ready to use.' -ForegroundColor Green
Write-Host ''
Write-Host '  Start it with the "Water Station POS" desktop shortcut,' -ForegroundColor Gray
Write-Host '  or by double-clicking "Start POS.bat" in this folder.' -ForegroundColor Gray
Write-Host ''
Write-Host '  Admin page : http://127.0.0.1:3000' -ForegroundColor Gray
Write-Host '  Sign in    : use the owner password shown by the step above.' -ForegroundColor Gray
Write-Host '               (If the account already existed, use the password you' -ForegroundColor Gray
Write-Host '                already have - then change it in Settings > Account.)' -ForegroundColor Gray
Write-Host ''
Write-Host '  Tip: change the owner password from Settings > Account once you are signed in.' -ForegroundColor Yellow
Write-Host ''
