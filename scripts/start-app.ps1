<#
.SYNOPSIS
  Starts Divination Station the way you do by hand: npm run build, then npm start (http://127.0.0.1:3000).

.DESCRIPTION
  Builds first, so the app always runs the code that is in this folder now. If the build fails, it says so in the log and starts
  the last build that worked, if there is one, so the app still comes up.
  Meant to be run hidden by the "Divination Station" scheduled task (scripts/install-app-startup.ps1), but you can run it by hand too.
  The log is %LOCALAPPDATA%\DivinationStation\app\app.log. It is started afresh each time, and the previous one is kept as app.old.log.

.PARAMETER SkipBuild  Start the last build without building again.
#>
[CmdletBinding()]
param(
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$logDir = Join-Path $env:LOCALAPPDATA 'DivinationStation\app'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir 'app.log'
if (Test-Path $log) { Move-Item -Force $log (Join-Path $logDir 'app.old.log') }

function Say([string]$text) { "[{0:yyyy-MM-dd HH:mm:ss}] {1}" -f (Get-Date), $text | Out-File -Append -Encoding utf8 $log }

Say "Starting Divination Station from $root"

if (-not $SkipBuild) {
  Say 'Building (npm run build)...'
  & npm.cmd run build 2>&1 | Out-File -Append -Encoding utf8 $log
  if ($LASTEXITCODE -ne 0) {
    if (Test-Path (Join-Path $root '.next\BUILD_ID')) {
      Say "The build failed (exit code $LASTEXITCODE). Starting the last build that worked instead."
    } else {
      Say "The build failed (exit code $LASTEXITCODE) and there is no earlier build to start. Fix the build, then run this again."
      exit 1
    }
  }
}

# A copy that keeps its data in a folder (DS_DB_DIR in .env.local, docs/move-off-neon.md) closes the database itself when it is stopped:
# NEXT_MANUAL_SIG_HANDLE leaves Ctrl+C to its handler (instrumentation-node.ts) instead of Next.js exiting at once.
if ((Test-Path '.env.local') -and (Select-String -Path '.env.local' -Pattern '^\s*DS_DB_DIR\s*=\s*\S' -Quiet)) { $env:NEXT_MANUAL_SIG_HANDLE = '1' }
Say 'Starting the server (npm start) on http://127.0.0.1:3000 ...'
& npm.cmd start 2>&1 | Out-File -Append -Encoding utf8 $log
Say "The server stopped (exit code $LASTEXITCODE)."
