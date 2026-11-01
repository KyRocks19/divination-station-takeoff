<#
.SYNOPSIS
  Makes scripts/start-app.ps1 run by itself every time you sign in to Windows, so Divination Station is always up. No administrator rights needed.

.DESCRIPTION
  Registers a Windows scheduled task named "Divination Station" for the signed-in user. It runs hidden, a short while after sign-in,
  builds the app and starts it on http://127.0.0.1:3000. Tailscale Serve keeps its own settings, so once you have run
  tailscale serve --bg --https=10000 http://127.0.0.1:3000 the tailnet address works again as soon as the app is up.
  Run this once, as the person who will be signed in. The log is %LOCALAPPDATA%\DivinationStation\app\app.log.

.PARAMETER Remove        Delete the task again.
.PARAMETER DelaySeconds  How long after sign-in to wait (default 30).
.PARAMETER SkipBuild     Start the last build at sign-in instead of building first.
#>
[CmdletBinding()]
param(
  [switch]$Remove,
  [int]$DelaySeconds = 30,
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$taskName = 'Divination Station'

if ($Remove) {
  if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "Removed the task '$taskName'. Divination Station will no longer start by itself."
  } else {
    Write-Host "There is no task called '$taskName'."
  }
  exit 0
}

$script = Join-Path $PSScriptRoot 'start-app.ps1'
$extra = if ($SkipBuild) { '-SkipBuild' } else { '' }
$me = "$env:USERDOMAIN\$env:USERNAME"
$argLine = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}" {1}' -f $script, $extra
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $argLine.Trim() -WorkingDirectory (Split-Path -Parent $PSScriptRoot)
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $me
$trigger.Delay = 'PT{0}S' -f $DelaySeconds
# No time limit: the server is meant to keep running. IgnoreNew stops a second copy fighting the first for port 3000.
$settingsSet = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
  -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId $me -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settingsSet -Principal $principal `
  -Description 'Builds and starts Divination Station on http://127.0.0.1:3000.' -Force | Out-Null

Write-Host "Done. '$taskName' will run $DelaySeconds seconds after you sign in as $me."
Write-Host 'Try it now without signing out:   Start-ScheduledTask -TaskName "Divination Station"'
Write-Host 'See how it went:                  Get-Content "$env:LOCALAPPDATA\DivinationStation\app\app.log" -Tail 30'
Write-Host 'Take it away again:               scripts\install-app-startup.ps1 -Remove'
