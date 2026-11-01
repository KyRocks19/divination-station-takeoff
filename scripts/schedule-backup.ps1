# Makes a Windows scheduled task that backs up the database (and the picture folder) every day.
# Run it once, yourself, from PowerShell in the project folder:   powershell -ExecutionPolicy Bypass -File scripts\schedule-backup.ps1
# Options:  -Time 03:30   -OutDir D:\Backups   -ArtDir C:\Users\you\DivinationStationArt   -TaskName "Divination Station backup"
# Remove it later with:   Unregister-ScheduledTask -TaskName "Divination Station backup" -Confirm:$false
param(
  [string]$Time = "03:30",
  [string]$OutDir = (Join-Path $HOME "DivinationStationBackups"),
  [string]$ArtDir = "",
  [string]$TaskName = "Divination Station backup"
)

$project = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$npx = (Get-Command npx.cmd -ErrorAction Stop).Source
$args = "tsx scripts/backup-db.ts --out `"$OutDir`""
if ($ArtDir -ne "") { $args += " --art-dir `"$ArtDir`"" }

$action = New-ScheduledTaskAction -Execute $npx -Argument $args -WorkingDirectory $project
$trigger = New-ScheduledTaskTrigger -Daily -At $Time
# StartWhenAvailable: if the computer was off at that time, the backup runs when it is next on.
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 1)

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description "Backs up the Divination Station database (read-only) to $OutDir" -Force | Out-Null
Write-Host "Scheduled '$TaskName' every day at $Time. Backups go to $OutDir."
Write-Host "It reads DATABASE_URL from .env.local in $project (the live database). Test it now with:"
Write-Host "  Start-ScheduledTask -TaskName '$TaskName'"
