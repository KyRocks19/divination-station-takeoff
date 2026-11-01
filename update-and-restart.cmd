@echo off
rem Stops the copy of Divination Station that runs from this folder (port 3000), pulls the newest commits, installs packages if they changed,
rem builds it and starts it again in its own window. It never runs a migration; it lists new ones (update-migrate-and-restart.cmd runs them).
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\update-and-restart.ps1" %*
pause
