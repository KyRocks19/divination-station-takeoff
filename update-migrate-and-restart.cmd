@echo off
rem Like update-and-restart.cmd, and it also migrates: stops the copy that runs from this folder (port 3000), pulls the newest commits, installs
rem packages if they changed, runs npm run migrate on the dev branch (.env.development.local), backs up live and migrates it (.env.local), builds,
rem and starts it again in its own window. It shows both database hosts and asks before it stops or migrates anything. See scripts\update-and-restart.ps1.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\update-and-restart.ps1" -Migrate %*
pause
