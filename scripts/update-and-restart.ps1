# Updates the copy of Divination Station that runs from this git folder on this computer, and starts it again (docs/setup-guide.md, "Updating the copy
# you run from the source"). Double-click update-and-restart.cmd in the project folder, or run it from PowerShell in the project folder:
#
#   powershell -ExecutionPolicy Bypass -File scripts\update-and-restart.ps1
#
# In order: stops the server on the port (3000 unless -Port), pulls the newest commits of this branch, installs packages when package-lock.json
# changed, builds, and starts it again in its own window. Whether it was `npm run start` or `npm run dev` is read from the stopped server, so the same
# kind comes back (-Mode start or -Mode dev to choose). Without -Migrate it never runs a migration: it lists the new ones, which you run yourself with
# `npm run migrate` when you are ready, because `npm run start` and `npm run migrate` use the live database (.env.local).
# With -Migrate (update-migrate-and-restart.cmd) it also brings both databases up to date before the build: the dev branch first
# (.env.development.local), then a backup of live (npm run backup), then live (.env.local). It shows both hosts and asks once, before anything is stopped.
# A failure on dev leaves live untouched; a failure anywhere stops before the app is started.
# Options:  -Port 3000   -Mode auto|start|dev   -NoPull (rebuild and restart what is here)   -Migrate (migrate dev, then live)
#           -Yes (do not ask before stopping the server or migrating)
param(
  [int]$Port = 3000,
  [ValidateSet("auto", "start", "dev")][string]$Mode = "auto",
  [switch]$NoPull,
  [switch]$Migrate,
  [switch]$Yes
)

$ErrorActionPreference = "Stop"
$project = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $project

function Fail($message) {
  Write-Host ""
  Write-Host $message -ForegroundColor Red
  exit 1
}

function Run($what, [string[]]$command) {
  Write-Host ""
  Write-Host "== $what" -ForegroundColor Cyan
  # Shown, not returned: a function's output is its answer, and the lines would make a failure look like success.
  & $command[0] $command[1..($command.Length - 1)] | Out-Host
  if ($LASTEXITCODE -ne 0) { return $false }
  return $true
}

foreach ($tool in @("git", "npm.cmd", "node")) {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { Fail "$tool was not found. Install it (README.md, Prerequisites) and open a new window." }
}

# The DATABASE_URL line of an env file in the project folder, or $null. migrate.ts and backup-db.ts use DATABASE_URL from the environment first.
function DatabaseUrlFrom($file) {
  $path = Join-Path $project $file
  if (-not (Test-Path $path)) { return $null }
  foreach ($line in Get-Content $path) {
    if ($line -match '^\s*DATABASE_URL\s*=(.*)$') { return $Matches[1].Trim().Trim([char]34, [char]39) }
  }
  return $null
}

# Only the host is ever printed, never the address (it holds the password).
function HostOf($url) {
  if ($url -match '@([^/:?]+)') { return $Matches[1] }
  return "(host not found in the address)"
}

# 0. With -Migrate: both addresses are found and checked before anything is stopped, so a missing file changes nothing.
if ($Migrate) {
  $devUrl = DatabaseUrlFrom ".env.development.local"
  $liveUrl = DatabaseUrlFrom ".env.local"
  if (-not $devUrl) { Fail "No DATABASE_URL line in .env.development.local (the dev branch). Nothing was stopped or changed." }
  if (-not $liveUrl) { Fail "No DATABASE_URL line in .env.local (the live database). Nothing was stopped or changed." }
  $devHost = HostOf $devUrl
  $liveHost = HostOf $liveUrl
  if ($devHost -eq $liveHost) {
    Fail "The dev and live addresses name the same host ($devHost), so 'dev first' would migrate live twice. Check .env.development.local. Nothing was stopped or changed."
  }
  Write-Host "Migrations will run on the dev branch ($devHost) first, then, after a backup, on live ($liveHost)."
  if (-not $Yes) {
    $answer = Read-Host "Migrate dev and then live? Type yes"
    if ($answer -notmatch "^y(es)?$") { Fail "Nothing was stopped or changed. To update without migrating, use update-and-restart.cmd." }
  }
}

# 1. Nothing of yours is overwritten: a pull with changes you have not committed stops here, before the server is stopped.
if (-not $NoPull) {
  $changed = git status --porcelain --untracked-files=no
  if ($changed) {
    Write-Host "These files have changes that are not committed:"
    $changed | ForEach-Object { Write-Host "  $_" }
    Fail "Commit them or put them aside (git stash) first, then run this again. Nothing was stopped or changed."
  }
}

# 2. The server on the port: which process, and whether it was started with `next dev` or `next start`.
$listening = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
$wasDev = $false
$toStop = @()
if ($listening) {
  foreach ($id in $listening) {
    # The process that listens is often a child (next-server) of `next start` or `next dev`, itself under npm: walk up to the top of that chain, so the
    # whole of it is stopped and none of it starts the server again.
    $top = $null
    $chain = ""
    $current = Get-CimInstance Win32_Process -Filter "ProcessId = $id" -ErrorAction SilentlyContinue
    for ($depth = 0; $current -and $depth -lt 6; $depth++) {
      $line = "$($current.Name) $($current.CommandLine)"
      if ($line -notmatch "node|npm|next") { break }
      $chain += " $line"
      $top = $current
      $current = Get-CimInstance Win32_Process -Filter "ProcessId = $($current.ParentProcessId)" -ErrorAction SilentlyContinue
    }
    if (-not $top -or $chain -notmatch "next") { Fail "Port $Port is used by another program (process ${id}), not this app. Nothing was stopped." }
    if ($chain -match "next(\.js)?[`"']?\s+dev\b|run\s+dev\b") { $wasDev = $true }
    $toStop += $top.ProcessId
  }
  $toStop = $toStop | Select-Object -Unique
  if (-not $Yes) {
    $answer = Read-Host "Stop the app on port $Port (process $($toStop -join ', '))? Type yes"
    if ($answer -notmatch "^y(es)?$") { Fail "Nothing was stopped or changed." }
  }
  foreach ($id in $toStop) {
    # The process and everything it started.
    & taskkill.exe /PID $id /T /F | Out-Null
  }
  for ($i = 0; $i -lt 20 -and (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue); $i++) { Start-Sleep -Milliseconds 500 }
  if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { Fail "The app on port $Port did not stop. Close its window yourself, then run this again with -NoPull." }
  Write-Host "Stopped the app on port $Port."
} else {
  Write-Host "Nothing was running on port $Port."
}
if ($Mode -eq "auto") { $Mode = if ($wasDev) { "dev" } else { "start" } }

# 3. The newest commits of this branch (fast-forward only, so your own commits are never rewritten).
$before = (git rev-parse HEAD).Trim()
if (-not $NoPull) {
  $branch = (git rev-parse --abbrev-ref HEAD).Trim()
  if (-not (Run "Pulling the newest commits of $branch" @("git", "pull", "--ff-only"))) {
    Fail "The pull did not work (above). The app is stopped and its files are as they were. Fix that, or start it as it was with: npm run $Mode"
  }
}
$after = (git rev-parse HEAD).Trim()
if ($before -eq $after) { Write-Host "Already up to date at $($after.Substring(0, 7))." } else { Write-Host "Updated from $($before.Substring(0, 7)) to $($after.Substring(0, 7))." }

# 4. Packages, only when the lock file changed (or they were never installed).
$lockChanged = ($before -ne $after) -and (git diff --name-only $before $after -- package-lock.json)
if ($lockChanged -or -not (Test-Path (Join-Path $project "node_modules"))) {
  if (-not (Run "Installing packages (package-lock.json changed)" @("npm.cmd", "ci"))) { Fail "npm ci did not work (above). The app is stopped." }
}

# 5. Migrations. With -Migrate: every file a database lacks, dev first, then live after a backup (npm run migrate skips what is applied, so this
# also catches one that was owed before this update). Without it: the new ones are listed, never run.
if ($Migrate) {
  $startHint = if ($Mode -eq "start") { "npm run build, then npm run start" } else { "npm run dev" }
  $env:DATABASE_URL = $devUrl
  if (-not (Run "Migrating the dev branch ($devHost)" @("npm.cmd", "run", "migrate"))) {
    Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
    Fail "The dev migration did not work (above). Live was not touched. The app is stopped; to start it anyway: $startHint"
  }
  $env:DATABASE_URL = $liveUrl
  if (-not (Run "Backing up live ($liveHost) before migrating it" @("npm.cmd", "run", "backup"))) {
    Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
    Fail "The backup of live did not work (above), so live was not migrated (dev was). The app is stopped; to start it anyway: $startHint"
  }
  if (-not (Run "Migrating live ($liveHost)" @("npm.cmd", "run", "migrate"))) {
    Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
    Write-Host ""
    Write-Host "The live migration did not work (above). Each file is recorded as it is applied, so the lines above show which ones are on live." -ForegroundColor Red
    Write-Host "The backup made just now is in the folder the backup step printed (DivinationStationBackups in your home folder unless BACKUP_DIR says otherwise; npm run restore puts it back). The app is stopped."
    exit 1
  }
  # The app started below must read its own env file (dev or live), not the address left here from the last migration.
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
} elseif ($before -ne $after) {
  $migrations = git diff --name-only --diff-filter=A $before $after -- migrations
  if ($migrations) {
    Write-Host ""
    Write-Host "New migrations came with this update:" -ForegroundColor Yellow
    $migrations | ForEach-Object { Write-Host "  $_" }
    Write-Host "The app works without them, with their features off. Run them on the live database yourself when you are ready: npm run migrate"
    Write-Host "(it reads .env.local and prints each file it applies)."
    Write-Host "Or next time use update-migrate-and-restart.cmd, which migrates dev, then live, then restarts."
  }
}

# 6. Build (start mode only; dev builds as it goes). A failed build leaves no working build, so it says how to go back.
if ($Mode -eq "start") {
  if (-not (Run "Building" @("npm.cmd", "run", "build"))) {
    Write-Host ""
    Write-Host "The build did not work (above). The app is stopped." -ForegroundColor Red
    if ($before -ne $after) {
      Write-Host "To go back to the version you had and start it again:"
      Write-Host "  git reset --hard $before"
      Write-Host "  powershell -ExecutionPolicy Bypass -File scripts\update-and-restart.ps1 -NoPull"
    }
    exit 1
  }
}

# 7. Start it in its own window, so closing this one does not stop it, and wait until it answers.
Write-Host ""
Write-Host "== Starting: npm run $Mode (in a new window; close that window to stop the app)" -ForegroundColor Cyan
$portArg = if ($Port -ne 3000) { " -- -p $Port" } else { "" }
# npm run start on a data folder (DS_DB_DIR in .env.local) closes its database itself on Ctrl+C; the new window inherits this (docs/move-off-neon.md).
if ($Mode -eq 'start' -and (Select-String -Path (Join-Path $project '.env.local') -Pattern '^\s*DS_DB_DIR\s*=\s*\S' -Quiet -ErrorAction SilentlyContinue)) { $env:NEXT_MANUAL_SIG_HANDLE = '1' }
Start-Process powershell.exe -WorkingDirectory $project -ArgumentList "-NoExit", "-Command", "npm run $Mode$portArg"
$url = "http://127.0.0.1:$Port/login"
for ($i = 0; $i -lt 90; $i++) {
  Start-Sleep -Seconds 1
  try {
    $status = (Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5).StatusCode
    if ($status -eq 200) {
      Write-Host ""
      Write-Host "The app is running again at http://localhost:$Port ($Mode, commit $($after.Substring(0, 7)))." -ForegroundColor Green
      exit 0
    }
  } catch { }
}
Fail "The app did not answer at $url within 90 seconds. Look at its window for the reason."
