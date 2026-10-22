$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$python = Join-Path $root '.venv\Scripts\python.exe'
$web = Join-Path $root 'web'

if (-not (Test-Path -LiteralPath $python)) {
    throw 'Chưa cài backend. Xem mục "Chạy nhanh cả web và API" trong README.md.'
}
if (-not (Test-Path -LiteralPath (Join-Path $web 'node_modules'))) {
    throw 'Chưa cài frontend. Chạy corepack pnpm install --frozen-lockfile trong thư mục web.'
}

function Test-HttpReady([string]$url) {
    try {
        $null = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2
        return $true
    } catch {
        return $false
    }
}

if (-not (Test-HttpReady 'http://127.0.0.1:8000/api/health')) {
    $apiPort = Get-NetTCPConnection -State Listen -LocalPort 8000 -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($apiPort) { throw 'Port 8000 is already used by another application.' }
    Start-Process -FilePath $python -WorkingDirectory $root -WindowStyle Hidden -ArgumentList @(
        '-m', 'uvicorn', 'api.main:app', '--host', '127.0.0.1', '--port', '8000'
    )
}

if (-not (Test-HttpReady 'http://localhost:5173/')) {
    $webPort = Get-NetTCPConnection -State Listen -LocalPort 5173 -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($webPort) { throw 'Port 5173 is already used by another application.' }
    Start-Process -FilePath 'powershell.exe' -WorkingDirectory $web -WindowStyle Hidden -ArgumentList @(
        '-NoProfile', '-Command', 'corepack pnpm dev -- --host 127.0.0.1 --port 5173 --strictPort'
    )
}
Write-Host 'Web:     http://localhost:5173'
Write-Host 'API:     http://127.0.0.1:8000/api/health'
Write-Host 'SQLite:  .data/vuonhoa.sqlite3'
