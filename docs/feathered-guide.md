# Divination Station: the Feathered edition

This is the light copy of Divination Station. It runs on **your own computer, or from a flash drive you carry**, and it is for one person.

- **It has no AI features.** No companion, no Claude buttons, no interviewer, no picture maker. Everything else is here: every tool, your own meanings, journals, Patterns, predictions and look-backs, "write what you sense first", the oracle deck kit with your own drawn or uploaded pictures, export and backups.
- **It connects to nothing outside this computer.** It answers only to this computer, and it sends nothing anywhere. Links to sources and help lines open only when you click them.
- **Want circles, or the AI companion?** Download the Winged edition and run its upgrade file on this folder (see "Moving to Winged" below). Your writing comes with you.

(Draft words, for the owner's wording pass.)

## Start it
Start it the same way as the full edition, from the folder you unzipped (or copied to your flash drive):
- **Windows:** double-click `start-divination-station.bat`. Windows may say "Windows protected your PC", because this program is not signed: choose **More info**, then **Run anyway**.
- **Mac:** the first time, open Terminal, type `sh ` (with a space), drag `start-divination-station.command` into the window and press Enter. After that, double-click it.
- **Linux:** run `sh start-divination-station.sh`.

The first start takes about half a minute. The start file then opens the app in a **private browser window** that keeps its settings in the `browser-profile` folder beside it, not on the computer (see "What it leaves on a computer"). Make your account: a name and a password or passphrase. It exists only in this folder.

The same screen asks whether to **lock your writing** with that password. Locking is chosen for you, and it is the right choice on a flash drive or a computer other people use (see "Locking your writing").

Leave the black window open while you use the app. To stop it, use **Stop and remove the drive** in Settings, or close the black window.

## On a flash drive
Copy the whole folder to the drive. If you will plug the drive into more than one kind of computer (a Windows computer at home and a Mac elsewhere, say), get the **any computer** download instead: it starts on Windows, Mac and Linux, and it is larger. Format the drive as **exFAT** if you can: Windows, Mac and Linux can all read and write it. A FAT32 drive works on Windows but cannot mark the Mac and Linux start files as runnable.

**Keep your writing locked on a flash drive.** A locked copy keeps everything in one sealed file, which any drive can hold. An unlocked copy keeps a folder of database files instead, and that folder does not work on an exFAT or FAT32 drive: the black window says the database could not be opened. If you want it unlocked, use an NTFS drive (Windows computers only).

Your writing is kept in the `my-data` folder beside the app, on the drive. Nothing of yours is written to the computer.

**Before you take the drive out:** in Settings, press **Stop and remove the drive** and wait for the page to say the app has stopped (or close the black window). On Windows, then use "Safely remove" on the drive.

## Where your writing is kept
The first screen also asks where to keep your writing:
- **On this drive, beside the app** (chosen for you). It stays in the `my-data` folder on the drive, and you carry it with you.
- **On this computer**, in a `Divination Station` folder in your Documents. This leaves a folder on that computer **on purpose**, and the drive then holds only the app: your writing opens only when the drive is plugged into that computer. Started on another computer, the app says so and stops.

To change it later: Settings, then **Where your data is**, then **Move it to this computer** (or **Move it to the drive**). The app copies everything, checks the copy, removes the old one, and stops; start it again and it opens your writing in its new place. When locking is on, your writing stays sealed in both places.

## Locking your writing
When your writing is locked, everything you write is kept as **one sealed file** (`my-data/feathered.sealed`) that nothing can read without your password. Your pictures and backups are sealed the same way. The app opens it only in memory while you use it, and writes it back, sealed, a few seconds after each change.

- **Your password opens it.** Signing in opens your writing; the quick hide locks it again at once.
- **Your recovery codes are the only way back** if you forget the password. You are shown them once, when you lock. Write them down, or keep them in a password manager, somewhere that is not this drive. **If you forget your password and lose your recovery codes, nobody can get your writing back.** There is no back door, on purpose.
- **Not hiding anything?** You can turn locking off: Settings, then **Lock my data**, then **Turn the lock off**. Your writing becomes an ordinary folder again.
- **Want it locked later?** Turn it on in the same place. You will be shown a new set of recovery codes.
- **Changing your password** changes the lock to the new password too.

## The quick hide
Press the **Hide** button at the top of any page, or press **Esc twice**. The app signs you out at once, locks your writing (when it is locked), and the tab becomes a small snake game. Every page shows the game until you come back. The app keeps running.

**To come back:** play a round. When it ends, the game asks for a name for the high-score table. Type **your password** there. Any other name just goes on the table, so someone else who plays sees an ordinary game.

In Settings, under Quick hide, you can choose what the snake eats: little keys and flames, or apples and berries.

**More ways to set it off.** Also under Quick hide, each of these can be off, **Lock** (the quick hide above) or **Stop and remove the drive** (it saves your data and stops the app, as the button in Settings does):
- **Esc pressed twice** (Lock unless you change it).
- **Two fingers tapped twice**, on a touch screen.
- **A hard shake**, on a tablet or a laptop that can tell it is moving (most cannot).
- **Leaving the page**: switching to another window or tab, or minimising the browser. Choosing a picture or a file, or printing, does not count.

A computer's other keys and a phone's buttons are not given to a web page, so they cannot be used. These choices are kept in this browser only.

## What it leaves on a computer
Said plainly, so you can decide where to use it:
- **Your writing:** nothing, unless you chose to keep it on this computer. Otherwise it stays on the drive (or in the folder). When it is locked, it is opened only in memory, never written to the computer's disk.
- **The browser:** when the start file finds Microsoft Edge, Chrome, Chromium or Firefox, it opens a private window with its own settings folder on the drive, so the computer's browser keeps no history of the app. If none is found, it says so: open a private window yourself and go to `http://localhost:47831`. Safari cannot be opened privately from a script: press Shift+Cmd+N first.
- **The computer itself:** Windows and macOS record that a program ran (on Windows, for example, in its "Prefetch" list). That record says that `node.exe` ran from the drive, not what you did with it, and removing it needs an administrator.
- **A watched computer:** a work or school computer, or one with monitoring software, can see what is on the screen and what is typed. No app can prevent that. Use Feathered only on a computer you trust.
- **If the drive is lost:** when your writing is locked, whoever finds the drive sees one sealed file, safe as long as your password is a strong one (a few unusual words together is good). When it is not locked, they can open the `my-data` folder.

## Updating to a newer version
1. Make a backup: Settings, **Backups**, **Back up now**. Copy the file somewhere that is not this drive.
2. Close the app, and unzip the new Feathered version to a new folder.
3. Copy your `my-data` folder (and `settings.env`, if you have one) into the new folder, beside its `app` folder.
4. Start the new version. The first start brings your writing up to date and saves a backup of it as it was. Your password and lock stay the same.

Keep the old folder until you have checked the new one. To keep the app in the same folder or on the same drive instead, run `update-a-copy` from the new download and give it the path of this folder. `UPGRADING.md`, in this folder, has the full steps and how to go back. If your writing is kept on the computer instead of the drive, read its part on that first.

## Moving to Winged
1. Close this copy (close the black window).
2. Download the Winged edition for this kind of computer and unzip it anywhere.
3. In the Winged folder, run `upgrade-a-feathered-copy` (`.bat` on Windows, `.command` on a Mac, `.sh` on Linux) and give it the path of this folder.
4. It keeps a copy of your `my-data` folder beside it, then puts the Winged app in this folder. Your writing and your password stay the same, and so does the lock: Winged opens a locked copy with the same password.

After moving, this copy **can** reach the internet, but only for an AI feature you turn on yourself. It is no longer the edition that connects to nothing.

To go back, the Feathered download has `switch-a-winged-copy-to-feathered`, which works the same way. Notes the AI wrote stay in your data and come back if you move to Winged again.

## Backups, export and the rest
Backups, export and import work as in the full edition: Settings, then Backups or Export. A backup holds your writing and no secrets. While your writing is locked, backups are sealed with the same lock, so they open only in this copy.
