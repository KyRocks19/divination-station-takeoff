<#
.SYNOPSIS
  Starts KoboldCpp for Divination Station: the image worker always, the text worker only if the graphics card has room.

.DESCRIPTION
  1. Starts the image worker (KoboldCpp with your picture model, from your image .kcpps file) and waits until it answers.
  2. Measures how much graphics memory (VRAM) is still free. If there is enough, starts the text worker (KoboldCpp in router mode,
     which the AI companion uses). If not, it says so in the log and carries on with the image worker alone.
  3. Optionally starts the picture studio (scripts/image-worker.ts), which carries pictures between the website and KoboldCpp.

  Settings live in scripts/koboldcpp-startup.local.json (copy koboldcpp-startup.example.json and edit the paths).
  Everything runs hidden; the logs are in %LOCALAPPDATA%\DivinationStation\koboldcpp\ (or the logDir you set).
  Your own .kcpps files are never changed: a patched copy (no browser tab opening) is what gets started.
  See docs/koboldcpp-startup.md for the whole story, including how to run this at every start-up.

.PARAMETER ConfigFile  A settings file other than scripts/koboldcpp-startup.local.json.
.PARAMETER ImageOnly   Start only the image worker (skip the text worker and its VRAM check).
.PARAMETER NoText      Same as -ImageOnly for the text worker; the studio, if enabled, still starts.
.PARAMETER ForceText   Start the text worker even if the VRAM check says there may not be room.
.PARAMETER Stop        Stop what an earlier run started (uses the process numbers saved in the log folder), then exit.
.PARAMETER DryRun      Print what would happen and start nothing.
#>
[CmdletBinding()]
param(
  [string]$ConfigFile,
  [switch]$ImageOnly,
  [switch]$NoText,
  [switch]$ForceText,
  [switch]$Stop,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
if (-not $ConfigFile) { $ConfigFile = Join-Path $PSScriptRoot 'koboldcpp-startup.local.json' }

# ---------- settings ----------
if (-not (Test-Path -LiteralPath $ConfigFile)) {
  Write-Error "No settings file at $ConfigFile. Copy scripts\koboldcpp-startup.example.json to scripts\koboldcpp-startup.local.json and edit the paths."
  exit 2
}
$cfg = Get-Content -LiteralPath $ConfigFile -Raw | ConvertFrom-Json

$logDir = $cfg.logDir
if (-not $logDir) { $logDir = Join-Path $env:LOCALAPPDATA 'DivinationStation\koboldcpp' }
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$startupLog = Join-Path $logDir 'startup.log'
$pidFile = Join-Path $logDir 'pids.json'

# Keep the log from growing for ever.
if ((Test-Path $startupLog) -and ((Get-Item $startupLog).Length -gt 1MB)) { Remove-Item $startupLog -Force }

function Write-Log([string]$msg) {
  $line = '{0}  {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
  Write-Host $line
  Add-Content -LiteralPath $startupLog -Value $line
}

# ---------- -Stop ----------
if ($Stop) {
  if (-not (Test-Path $pidFile)) { Write-Log 'Nothing to stop: no saved process numbers.'; exit 0 }
  $saved = Get-Content $pidFile -Raw | ConvertFrom-Json
  foreach ($p in $saved.PSObject.Properties) {
    if ($p.Name -like '*Started') { continue }
    $startedAt = $saved.PSObject.Properties[($p.Name + 'Started')].Value
    $proc = Get-Process -Id $p.Value -ErrorAction SilentlyContinue
    # Only stop it if it is the very same process (the number could have been reused since).
    if ($proc -and ([datetime]$startedAt).ToUniversalTime() -eq $proc.StartTime.ToUniversalTime()) {
      Write-Log "Stopping $($p.Name) (process $($p.Value))."
      # /T: KoboldCpp starts helper processes of its own, and they hold the graphics memory.
      & taskkill /PID $p.Value /T /F | Out-Null
    }
  }
  Remove-Item $pidFile -Force
  exit 0
}

# ---------- helpers ----------
function Quote([string]$s) { '"' + $s + '"' }

function Test-PortListening([int]$port) {
  $null -ne (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
}

# True once something answers HTTP on the port (any status counts: a password-protected router answers 401).
function Wait-ForPort([int]$port, [int]$timeoutSec, $proc) {
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  while ((Get-Date) -lt $deadline) {
    if ($proc -and $proc.HasExited) { return $false }
    try {
      Invoke-WebRequest -Uri "http://127.0.0.1:$port/api/extra/version" -UseBasicParsing -TimeoutSec 5 | Out-Null
      return $true
    } catch {
      if ($_.Exception.Response) { return $true }
    }
    Start-Sleep -Seconds 3
  }
  return $false
}

# Total and used dedicated graphics memory of the biggest card, in MB. $null if Windows will not say.
function Get-Vram {
  try {
    $class = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'
    $total = 0
    foreach ($k in Get-ChildItem $class -ErrorAction SilentlyContinue) {
      $v = (Get-ItemProperty $k.PSPath -ErrorAction SilentlyContinue).'HardwareInformation.qwMemorySize'
      if ($null -eq $v) { continue }
      if ($v -is [byte[]]) { $v = [BitConverter]::ToUInt64($v, 0) }
      $mb = [math]::Round([uint64]$v / 1MB)
      if ($mb -gt $total) { $total = $mb }
    }
    if ($total -le 0) { return $null }
    $used = 0
    foreach ($s in (Get-Counter '\GPU Adapter Memory(*)\Dedicated Usage').CounterSamples) {
      $mb = [math]::Round($s.CookedValue / 1MB)
      if ($mb -gt $used) { $used = $mb }
    }
    return [pscustomobject]@{ TotalMB = $total; UsedMB = $used; FreeMB = $total - $used }
  } catch { return $null }
}

function Read-EnvValue([string]$file, [string]$name) {
  if (-not $file -or -not (Test-Path -LiteralPath $file)) { return $null }
  foreach ($line in Get-Content -LiteralPath $file) {
    if ($line -match ('^\s*' + [regex]::Escape($name) + '\s*=\s*(.*)$')) { return $Matches[1].Trim().Trim('"').Trim("'") }
  }
  return $null
}

function Get-KcppsPort([string]$file) {
  $raw = Get-Content -LiteralPath $file -Raw
  if ($raw -match '"port"\s*:\s*(\d+)') { return [int]$Matches[1] }
  return 5001
}

# A copy of the person's .kcpps that does not open a browser tab or a launcher window. Their original is untouched.
function New-HeadlessConfig([string]$src, [string]$name, [hashtable]$set = @{}) {
  $raw = Get-Content -LiteralPath $src -Raw
  # Optional replacements of single text settings, such as the model's path (see image.model in the settings file).
  foreach ($key in $set.Keys) {
    if (-not $set[$key]) { continue }
    $value = ($set[$key] -replace '\\', '/')
    $raw = $raw -replace ('"' + $key + '"\s*:\s*"[^"]*"'), ('"' + $key + '": "' + $value + '"')
  }
  $raw = $raw -replace '"launch"\s*:\s*true', '"launch": false'
  $raw = $raw -replace '"showgui"\s*:\s*true', '"showgui": false'
  $raw = $raw -replace '"skiplauncher"\s*:\s*false', '"skiplauncher": true'
  $dest = Join-Path $logDir ($name + '.headless.kcpps')
  [System.IO.File]::WriteAllText($dest, $raw, (New-Object System.Text.UTF8Encoding($false)))
  return $dest
}

function Start-Hidden([string]$file, [string]$argLine, [string]$workDir, [string]$logName) {
  $out = Join-Path $logDir ($logName + '.log')
  $err = Join-Path $logDir ($logName + '.err.log')
  Start-Process -FilePath $file -ArgumentList $argLine -WorkingDirectory $workDir -WindowStyle Hidden `
    -RedirectStandardOutput $out -RedirectStandardError $err -PassThru
}

$started = [ordered]@{}
function Remember($name, $proc) {
  $started[$name] = $proc.Id
  $started[$name + 'Started'] = $proc.StartTime.ToString('o')
}

# Python (inside KoboldCpp) can trip over a redirected log file unless told to use UTF-8.
$env:PYTHONUTF8 = '1'
$env:PYTHONIOENCODING = 'utf-8'

# ---------- checks ----------
$exe = $cfg.koboldcppExe
if (-not (Test-Path -LiteralPath $exe)) { Write-Log "koboldcppExe not found: $exe. Nothing was started."; exit 2 }
$exeDir = Split-Path -Parent $exe
$startupTimeout = 600
if ($cfg.startupTimeoutSeconds) { $startupTimeout = [int]$cfg.startupTimeoutSeconds }

$wantImage = [bool]$cfg.image.enabled
$wantText = [bool]$cfg.text.enabled -and -not $ImageOnly -and -not $NoText
$wantStudio = [bool]$cfg.studio.enabled -and -not $ImageOnly

Write-Log "---- start-koboldcpp (image=$wantImage text=$wantText studio=$wantStudio dryRun=$($DryRun.IsPresent)) ----"

# A file that has moved (the .kcpps files were moved once already) switches off only the worker that needs it; the others still start.
function Test-NeededFiles([string]$worker, [string[]]$files) {
  $missing = @($files | Where-Object { $_ -and -not (Test-Path -LiteralPath $_) })
  foreach ($m in $missing) { Write-Log "$worker worker: skipped, a file named in the settings was not found: $m" }
  return ($missing.Count -eq 0)
}
if ($wantImage) { $wantImage = Test-NeededFiles 'Image' @($cfg.image.config, $cfg.image.model, $cfg.image.upscaler) }
if ($wantText) { $wantText = Test-NeededFiles 'Text' @($cfg.text.config, $cfg.text.adminDir) }

# ---------- 1. image worker ----------
$imageProc = $null
if ($wantImage) {
  $imagePort = Get-KcppsPort $cfg.image.config
  if (Test-PortListening $imagePort) {
    Write-Log "Image worker: port $imagePort is already in use, so it is probably running already. Leaving it alone."
  } elseif ($DryRun) {
    Write-Log "Image worker: would start $exe --config <headless copy of $($cfg.image.config)> --skiplauncher (port $imagePort)."
  } else {
    $conf = New-HeadlessConfig $cfg.image.config 'image' @{ sdmodel = $cfg.image.model; sdupscaler = $cfg.image.upscaler }
    $imageProc = Start-Hidden $exe ("--config $(Quote $conf) --skiplauncher") $exeDir 'image'
    Remember 'image' $imageProc
    Write-Log "Image worker: started (process $($imageProc.Id)), loading the picture model. Log: $(Join-Path $logDir 'image.log')"
    if (Wait-ForPort $imagePort $startupTimeout $imageProc) {
      Write-Log "Image worker: ready on port $imagePort."
    } else {
      Write-Log "Image worker: did NOT become ready within $startupTimeout seconds (or it stopped). Read image.err.log and image.log in $logDir."
    }
  }
}

# ---------- 2. text worker, only if there is room ----------
if ($wantText) {
  $textPort = Get-KcppsPort $cfg.text.config
  $minFree = 8500
  if ($cfg.text.minFreeVramMB) { $minFree = [int]$cfg.text.minFreeVramMB }

  $password = $cfg.text.adminPassword
  if (-not $password) { $password = Read-EnvValue $cfg.envFile 'COMPANION_PASSWORD' }
  $adminDir = $cfg.text.adminDir
  if (-not $adminDir) { $adminDir = Split-Path -Parent $cfg.text.config }

  if (Test-PortListening $textPort) {
    Write-Log "Text worker: port $textPort is already in use, so it is probably running already. Leaving it alone."
  } elseif (-not $password) {
    Write-Log 'Text worker: skipped. Router mode needs an admin password: set text.adminPassword, or COMPANION_PASSWORD in the file named by envFile.'
  } else {
    $vram = Get-Vram
    $room = $false
    if ($null -eq $vram) {
      Write-Log 'Text worker: could not read the graphics memory from Windows.'
      $room = $ForceText.IsPresent
    } else {
      Write-Log ("Graphics memory: {0} MB total, {1} MB in use, {2} MB free (the text worker wants {3} MB free)." -f $vram.TotalMB, $vram.UsedMB, $vram.FreeMB, $minFree)
      $room = ($vram.FreeMB -ge $minFree) -or $ForceText.IsPresent
    }
    if (-not $room) {
      Write-Log 'Text worker: NOT started, not enough free graphics memory. The image worker carries on alone. (Use -ForceText to try anyway, or lower text.minFreeVramMB.)'
    } else {
      $argLine = "--config {0} --skiplauncher --routermode --admin --admindir {1} --adminpassword {2} --port {3}" -f (Quote (New-HeadlessConfig $cfg.text.config 'text')), (Quote $adminDir), (Quote $password), $textPort
      if ($DryRun) {
        Write-Log ("Text worker: would start: $exe " + ($argLine -replace [regex]::Escape((Quote $password)), '"****"'))
      } else {
        $textProc = Start-Hidden $exe $argLine $exeDir 'text'
        Remember 'text' $textProc
        Write-Log "Text worker: started (process $($textProc.Id)), loading the text model. Log: $(Join-Path $logDir 'text.log')"
        if (Wait-ForPort $textPort $startupTimeout $textProc) {
          Write-Log "Text worker: ready on port $textPort."
        } else {
          Write-Log "Text worker: did NOT become ready within $startupTimeout seconds (or it stopped). Read text.err.log and text.log in $logDir."
        }
      }
    }
  }
}

# ---------- 3. picture studio (optional) ----------
if ($wantStudio) {
  $app = $cfg.studio.appFolder
  # studio.envFile: the settings file the studio reads (its --env switch). Left empty, the studio reads .env.local in appFolder.
  $studioEnv = $cfg.studio.envFile
  $studioArgs = '/c npx tsx scripts/image-worker.ts'
  if ($studioEnv) { $studioArgs += ' --env ' + (Quote $studioEnv) }
  if (-not (Test-Path -LiteralPath (Join-Path $app 'scripts\image-worker.ts'))) {
    Write-Log "Studio: skipped, no scripts\image-worker.ts under studio.appFolder ($app)."
  } elseif ($studioEnv -and -not (Test-Path -LiteralPath $studioEnv)) {
    # Not starting beats quietly falling back to .env.local, which may point at a different website.
    Write-Log "Studio: skipped, studio.envFile not found: $studioEnv"
  } elseif ($DryRun) {
    Write-Log "Studio: would start 'npx $($studioArgs.Substring(7))' in $app."
  } else {
    $studio = Start-Hidden 'cmd.exe' $studioArgs $app 'studio'
    Remember 'studio' $studio
    $which = if ($studioEnv) { $studioEnv } else { '.env.local' }
    Write-Log "Studio: started (process $($studio.Id)) with settings from $which. Log: $(Join-Path $logDir 'studio.log')"
  }
}

if ($started.Count -gt 0) { ($started | ConvertTo-Json) | Set-Content -LiteralPath $pidFile -Encoding ASCII }
Write-Log 'Done. Stop everything this started with: scripts\start-koboldcpp.ps1 -Stop'
