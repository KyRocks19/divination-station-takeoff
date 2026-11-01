# Updating Divination Station

This guide is for a copy you downloaded (Feathered or Winged) or run in Docker. It explains how to move to a newer
version and keep everything you wrote.

**The short version:** make a backup, close the app, unzip the new version to a new folder, copy your `my-data` folder
(and `settings.env`, if you have one) into it, and start the new version. The first start brings your data up to date by
itself and keeps a copy of it as it was. Keep the old folder until you have checked that the new one works.

The app never checks for a new version by itself, because it does not connect to the internet on its own. New versions
are published in the same place you got this one.

## What changes and what stays
- **The app folder** (`app`, `node`, the start files and the guides) is replaced by each new version. It holds nothing
  of yours.
- **Your data** is all in the `my-data` folder beside the app: the database, your pictures, your backups and the secrets
  the app made for itself the first time (`database.secrets.json`). A new version reads the same
  folder. Keep it together; do not take files out of it.
- **Your settings** are in `settings.env`, if you made one. Copy it across too.
- **Your password, your lock and your recovery codes** stay the same. A locked copy opens with the same password after an
  update.

## Which version you have
Open `VERSION.txt` in the app folder. It says the edition, the version number, the kind of computer and the day it was
built. Compare it with the version on the download page.

Version numbers look like `0.1.0`. Read the notes published with each new version before you update. They say what is
new and anything to do before or after the update. You can skip versions: going from 0.1.0 straight to 0.4.0 works, and
all the steps in between are applied at the first start.

## Before you update: make a backup
1. Open the app and go to Settings, then **Backups**.
2. Press **Back up now**.
3. Copy that backup file somewhere off this computer or drive (another drive, or a cloud folder you trust). The Backups
   card says which folder the files are in.

The app also makes a backup by itself at the first start of a new version, before it changes anything. The one you make
now is your own copy, kept outside the app's folders.

If your writing is locked, your backups are locked with the same password, and open only in a copy of Divination
Station with that password or a recovery code.

## Update a portable folder (Windows, Mac, Linux, a flash drive)
1. **Close the app.** On a flash drive, press **Stop and remove the drive** in Settings, or close the black window
   (Ctrl+C in a Mac or Linux terminal). Wait until it has stopped.
2. **Download the new version** of the same edition, for the same kind of computer (or the **any computer** file, if
   that is what you had). Check the download if you want to (see "Check the download" in `README.md`).
3. **Unzip it to a new folder**, beside the old one. Do not unzip it over the old folder. For example:
   `C:\DivinationStation` stays, and the new version goes in `C:\DivinationStation-0.2.0`.
4. **Copy your `my-data` folder** from the old folder into the new one, so it sits beside the new `app` folder. Copy
   `settings.env` too, if the old folder has one. Copy, do not move: the old folder stays as it was, so you can go back.
5. **Start the new version** with its start file, as before. Windows and macOS may warn about an unsigned program again,
   because it is a new file: choose **More info**, then **Run anyway** on Windows, or follow the first-start steps in
   `README.md` on a Mac.
6. **Check it.** The first start can take a little longer while the data is brought up to date. Sign in, and open a few
   of your readings, journals and pictures.
7. When you are happy with it, you can delete the old folder. Until then, keep it.

The address stays `http://localhost:47831` (or the `PORT` in your `settings.env`), so bookmarks keep working.

### Or: update the folder where it is
If you would rather keep the app in the same folder (for example on a flash drive, or because a shortcut points to it),
the new download has a file that updates an older copy in place.
1. Make a backup and close the app, as above.
2. Unzip the new version anywhere, for example in your Downloads folder.
3. In the **new** folder, run `update-a-copy` (`.bat` on Windows, `.command` on a Mac, `.sh` on Linux). Give it the path
   of your copy when it asks, and type `yes`.
4. It checks that your copy is closed, is the same edition, and is not newer than the download. It then keeps a copy of
   your `my-data` folder beside it (`my-data.before-update-<old version>-<date>`), and replaces the app files. Your
   `my-data` and `settings.env` stay where they are.
5. Start your copy with its start file, as before, and check it.
6. You can delete the unzipped download afterwards. When you are happy with the update, you can delete the
   `my-data.before-update-...` folder too: it is your data as it was, kept in case you want to go back.

It refuses a copy of the other edition (it names the file to use instead), and it never puts an older version over a
newer one.

### If your writing is kept on the computer, not beside the app (Feathered)
If you chose **On this computer** at the first screen, your writing is in a `Divination Station` folder in your
Documents, and the `my-data` folder beside the app holds only a note saying where it is. Copy that `my-data` folder into
the new version as in step 4. The new version finds your writing in Documents the same way.

Both the old and the new folder then use that **one** folder in Documents, so the old folder is not a way back after the
update. Make the backup first and copy it somewhere safe: to go back, you restore it (see "Going back to an older
version").

### Feathered and Winged
Update within the same edition: Feathered to a newer Feathered, Winged to a newer Winged. To change edition, use the
upgrade file that comes in the download (`upgrade-a-feathered-copy` in Winged, `switch-a-winged-copy-to-feathered` in
Feathered), as described in the Feathered guide. It changes the edition in place and keeps your data. Changing edition
and version in one go works too: the newer download's upgrade file brings the newer version.

## Update Docker
Your data is in the `ds-data` Docker volume, not in the app's files.
1. Make a backup (Settings, **Backups**, **Back up now**) and copy the file out of the volume if you want a copy outside
   Docker.
2. Stop the app: `docker compose down`. **Never add `-v`**: `docker compose down -v` deletes the volume and everything in
   it.
3. Put the new version's files in your folder (for example `git pull`, or unzip the new source over it). If you changed
   `docker-compose.yml` (a Claude key, host mode), keep your changes.
4. Build and start: `docker compose up --build`.
5. Open `http://localhost:47831` and check your writing.

## Host mode (serving a circle)
Everything above applies, plus: tell your circle the app will be down for a few minutes, and check that it starts before
you tell them it is back. Your Tailscale or Headscale address does not change. `HOSTING.md`, section 6, has the full
steps.

## What happens at the first start of a new version
- The app sees that the new version has changes to how data is stored, and **saves a backup first**, named
  `...-before-update` in the Backups list. The newest three of these are kept.
- It then applies the changes one by one. Each change either finishes or is undone, so a failed change leaves your data
  as it was before that change began.
- It fills in shared reference text that is new in this version (for example new encyclopedia entries). It never changes
  or removes what you wrote.

These changes only add things. A new version does not remove or rewrite your readings, journals, meanings or pictures.

## If something goes wrong
- **The new version will not start, or says the data folder is already open:** the old copy may still be running.
  Close it and try again. If you are sure nothing is running, delete `my-data/database.lock` in the new folder and try
  again.
- **The new version starts, but something of yours looks wrong or missing:** stop the new version. Start the old folder
  again: it still has its own `my-data`, exactly as it was before the update. Anything you wrote in the new version is
  not in it. Then tell the person you got the download from what you saw.
- **You copied instead of moving, but deleted the old folder already:** open Settings, **Backups** in the new version and
  restore the `before-update` backup with **Restore…**. That is your data as it was before the update. To go back to
  an older version instead, see "Going back to an older version" below.
- **The black window says the data was last used by a newer version, with changes this version cannot use:** this
  version is older than the one that last opened your data, and that newer version changed something this one could
  misread. It does not open the data, and nothing was changed. Start the newer version instead, or see "Going back to an
  older version" below.
- **The new download is damaged** (it will not unzip, the start window shows an error before the app opens, or
  `SHA256SUMS.txt` does not match): your data is not changed until the new version has started and brought it up to
  date. Delete the damaged folder, download the new version again, and check it before you start it. Your old folder
  still works meanwhile.
- **The black window says a migration failed:** that one change was undone, and the backup from before the update is
  in the backups folder. Do not delete anything. Start the old folder to keep using the app, and send the message to
  the person you got the download from.

## Going back to an older version
Start the old folder you kept. It has your data as it was before the update.

**To keep what you wrote in the newer version,** close it and copy its `my-data` folder into the older version's
folder instead. Most updates only add things (a new table for a new feature, for example), and say so. An older version
opens data from such an update and goes on using everything it already has; the new features' data stays in the folder,
unused, and is there again when you update once more. If the newer version changed something the older one could
misread, the older one stops at the start, says so, and changes nothing. Then use the old folder or a backup from before
the update, as below.

If you updated with `update-a-copy`, the data as it was is in the `my-data.before-update-...` folder beside `my-data`.
Unzip the older version to a new folder and copy that folder into it, renamed to `my-data`.

If the old folder no longer has your data as it was (it was deleted, or your writing is kept in Documents), start the
old version and restore the backup you made before the update: Settings, **Backups**, then **Restore…** beside it. If
the file is not in the list, put it in the backups folder that card names and reload the page. Restoring replaces
everything in that copy with the backup, so anything written after the backup was made is not in it.
