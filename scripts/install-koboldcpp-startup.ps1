<#
.SYNOPSIS
  Makes scripts/start-koboldcpp.ps1 run by itself every time you sign in to Windows. No administrator rights needed.

.DESCRIPTION
  Registers a Windows scheduled task named "Divination Station KoboldCpp" for the signed-in user. It runs hidden, a short while
  after sign-in (so the desktop and the graphics driver have settled), and starts the image worker and, if there is room, the text worker.
  Run this once on each computer, by the person who will be signed in on it. Each computer needs its own
  scripts/koboldcpp-startup.local.json (copy the .example.json).

  Why "sign in" and not "boot": KoboldCpp uses the graphics card through your own desktop session, so it cannot start before anyone is
  signed in. For a computer that should come back by itself after a power cut, also turn on automatic sign-in (docs/koboldcpp-startup.md).

.PARAMETER Remove        Delete the task again.
.PARAMETER DelaySeconds  How long after sign-in to wait (default 45).
.PARAMETER ExtraArgs     Extra switches for start-koboldcpp.ps1, for example '-ImageOnly'.
#>
[CmdletBinding()]
param(
  [switch]$Remove,
  [int]$DelaySeconds = 45,
  [string]$ExtraArgs = ''
)

$ErrorActionPreference = 'Stop'
$taskName = 'Divination Station KoboldCpp'

if ($Remove) {
  if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "Removed the task '$taskName'. KoboldCpp will no longer start by itself."
  } else {
    Write-Host "There is no task called '$taskName'."
  }
  exit 0
}

$script = Join-Path $PSScriptRoot 'start-koboldcpp.ps1'
$settings = Join-Path $PSScriptRoot 'koboldcpp-startup.local.json'
if (-not (Test-Path $settings)) {
  Write-Error "Make scripts\koboldcpp-startup.local.json first (copy koboldcpp-startup.example.json and edit the paths), then run this again."
}

$me = "$env:USERDOMAIN\$env:USERNAME"
$argLine = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}" {1}' -f $script, $ExtraArgs
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $argLine.Trim() -WorkingDirectory (Split-Path -Parent $PSScriptRoot)
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $me
$trigger.Delay = 'PT{0}S' -f $DelaySeconds
$settingsSet = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Hours 1) -MultipleInstances IgnoreNew
# Interactive + Limited: runs as you, in your session (the graphics card needs that), without administrator rights.
$principal = New-ScheduledTaskPrincipal -UserId $me -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settingsSet -Principal $principal `
  -Description 'Starts the KoboldCpp image worker (and the text worker if there is room) for Divination Station.' -Force | Out-Null

Write-Host "Done. '$taskName' will run $DelaySeconds seconds after you sign in as $me."
Write-Host 'Try it now without signing out:   Start-ScheduledTask -TaskName "Divination Station KoboldCpp"'
Write-Host 'Take it away again:               scripts\install-koboldcpp-startup.ps1 -Remove'
