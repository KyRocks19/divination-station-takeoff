# Divination Station: the full local edition

This is a copy of Divination Station that runs on **your own computer**. What you write stays in a folder on it. Nothing is sent anywhere unless you press a button that says so (for example when you give it your own Claude key).

It has no forum, no circles and no other people's accounts: it is for one person. A circle leader who wants to serve friends over Tailscale or Headscale can turn on host mode; read `HOSTING.md` first.

## Start it: Windows (the portable folder)
1. Unzip the download to a folder you will remember, for example `C:\DivinationStation`. Do not run it from inside the zip.
2. Double-click `start-divination-station.bat`.
3. **Windows may say "Windows protected your PC".** This program is not signed, because signing costs money and this project is distributed in small communities. To go on, choose **More info**, then **Run anyway**. You can first check that the download is the one that was published (below).
4. A black window opens and says it is starting. The first start takes about half a minute. Your browser then opens at `http://localhost:47831`. If it does not, type that address yourself.
5. Make your account (a name and a password or passphrase). It exists only on this computer.
6. Leave the black window open while you use the app. Close it to stop the app.

Nothing needs to be installed: Node.js is in the `node` folder.

## Start it: Linux
1. Download the Linux file that matches your computer (`linux-x64` for most PCs, `linux-arm64` for an ARM computer such as a Raspberry Pi 4 or 5) and unpack it: `tar -xzf divination-station-linux-x64.tar.gz`.
2. In the folder, run `sh start-divination-station.sh`. Your browser opens at `http://localhost:47831` (or open it yourself).
3. Press Ctrl+C in the terminal to stop it.

Node.js is in the `node` folder. This build needs a common Linux (glibc) such as Ubuntu, Debian or Fedora; Alpine is not supported (use Docker there).

## Start it: Mac
1. Download the file that matches your Mac (`darwin-arm64` for Apple silicon, `darwin-x64` for an Intel Mac) and double-click it to unpack, or run `tar -xzf` on it.
2. **The first time**, open Terminal, type `sh ` (with a space), drag `start-divination-station.command` into the Terminal window, and press Enter. This works around macOS refusing a downloaded program from an unknown developer, and the script clears the "downloaded" mark from the folder so later you can just double-click `start-divination-station.command`. If macOS still says it cannot be opened, open System Settings, Privacy & Security, and choose **Open Anyway**.
3. Your browser opens at `http://localhost:47831`. Press Ctrl+C in the Terminal window, or close it, to stop.

The Mac build has not been run on a Mac by the people who made it; it is built the same way as the Linux one, which has been run.

## Start it: Docker
Install Docker Desktop (or Docker Engine and the Compose plugin). In this folder run:

    docker compose up --build

Then open `http://localhost:47831`. Your data lives in a Docker volume called `ds-data`. To stop: `docker compose down` (your data stays). To remove the data as well, `docker compose down -v`, which cannot be undone. The port is published on `127.0.0.1` only, so other computers cannot reach it.

## Where your data is
In the portable folder: the `my-data` folder next to `app`. The database is `my-data\database`; pictures you add are files in `my-data\pictures`; the secrets the app made for itself are in `my-data\database.secrets.json`. Keep those together.

**Back it up** by closing the app and copying the whole `my-data` folder. The app also makes a weekly backup of its database by itself (Settings, Backups), and has a "Back up now" button.

**Update it** by making a backup, closing the app, unzipping the new version to a new folder, and copying your `my-data` folder (and `settings.env`, if you have one) into it. The app folder holds no data of yours. The first start of the new version brings the data up to date and saves a backup of it as it was. The full steps, for Docker too, and how to go back, are in `UPGRADING.md`.

## Settings you may want
Copy `settings.example.env` to `settings.env` and take out the `#` before a line:
- `ANTHROPIC_API_KEY`: your own Claude key, to turn the Claude features on. Without it they are off. Keep this file private.
- `IMAGE_GEN_URL`: the address of an image program on your computer (see `docs/picture-model-at-home.md`), to make pictures.
- `PORT`: another port, if 47831 is taken.
- `DS_DATA`: keep your data in another folder.

## Check the download (optional)
The published checksum is a long line of letters and digits that changes if one byte of the zip changes. In PowerShell, in the folder with the zip:

    Get-FileHash -Algorithm SHA256 .\divination-station.zip

If it does not match the line published beside the download, do not use the file. Inside the folder, `SHA256SUMS.txt` lists the checksum of every file.

## If something goes wrong
- **The window closes at once or says another copy is running:** only one copy can use a data folder. Close the other window first.
- **The page does not load:** the port may be taken. Set `PORT` in `settings.env`.
- **"This address is not one this copy answers to":** open it as `http://localhost:47831`, not by your computer's name.
- **Your antivirus quarantines `node.exe`:** this is a false alarm that unsigned programs sometimes get. `node.exe` is the official Node.js program; compare its checksum with the one on nodejs.org if you want to be sure.

The app is free software under the AGPL-3.0 licence (`LICENSE`, `NOTICE`).
