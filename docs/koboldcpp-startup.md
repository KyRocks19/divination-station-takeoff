# Starting KoboldCpp by itself when the computer starts

Written 2026-10-18. For the person whose computer makes the pictures (and, if it has room, answers the AI companion). It builds on
`docs/picture-model-at-home.md`, which explains what KoboldCpp is and how to get the program and a model.

## What the script does
`scripts/start-koboldcpp.ps1`, in this order:

1. **Image worker.** Starts KoboldCpp with your picture model (your image `.kcpps` file) and waits until it answers (about 10 seconds
   with DreamShaper 8 on the RX 6700 XT).
2. **Text worker, only if there is room.** Asks Windows how much graphics memory (VRAM) is still free. If there is at least
   `text.minFreeVramMB` (default 8500), it starts KoboldCpp in router mode on port 5002 for the AI companion. If not, it writes that to the log and
   carries on with the image worker alone. The image worker goes first on purpose: it is the one the website queue depends on, and the
   text model would otherwise take the whole card.
3. **Picture studio (optional).** With `studio.enabled` it also starts `scripts/image-worker.ts` (what `start-picture-studio.cmd` runs).

Everything runs hidden. Your own `.kcpps` files are never changed: the script starts a patched copy that does not open a browser tab or the
launcher window. Logs: `%LOCALAPPDATA%\DivinationStation\koboldcpp\` (`startup.log` says what happened; `image.log`, `text.log`, `studio.log`
and the `.err.log` files are each program's own output).

**What I measured on this PC (RX 6700 XT, 12 GB):** Windows itself holds about 2.3 GB; DreamShaper 8 adds about 1.8 GB; Gemma 4 (Q4, 16k
context) takes about 8.4 GB. Together that is more than 12 GB, so on this card **the text worker is normally skipped** while the image worker
is up. To get both you can lower `contextsize` in the Gemma `.kcpps` (less memory for the conversation), or use `-ForceText`, which lets KoboldCpp
put some of Gemma's layers on the processor instead (it works, but answers are slower). If the text worker matters more to you than the
pictures on a given computer, set `"enabled": false` under `image` in the settings file.

## One-time setup (each computer)
1. Copy `scripts/koboldcpp-startup.example.json` to `scripts/koboldcpp-startup.local.json` and edit the paths (the `.local.json` is not
   committed; it is this computer's own). On this PC it already exists.
   - `koboldcppExe`: your `koboldcpp.exe` or `koboldcpp-nocuda.exe`.
   - `image.config`: the `.kcpps` for the picture model. `image.model` (and optionally `image.upscaler`) replace the model paths inside it,
     so you can move model files without re-saving the config. Leave them `""` to use what the `.kcpps` says.
   - `text.config`, `text.adminDir`: the Gemma `.kcpps` and the folder with your text-model `.kcpps` files (as in `docs/companion.md`).
   - `text.adminPassword`: leave `""` and the script reads `COMPANION_PASSWORD` from the file named in `envFile`.
   - `studio`: set `enabled` to `true` on a computer that serves the website's picture queue, with `appFolder` the app's folder.
     `envFile` is the settings file the studio reads (passed to it as `--env`). Leave it `""` and the studio reads `.env.local` in
     `appFolder`, which holds the live database's address and may not have your `WORKER_TOKEN`. A file of its own is tidier: for example
     `.env.studio` with `APP_URL`, `WORKER_TOKEN`, `IMAGE_GEN_URL`, `COMPANION_URL`, `COMPANION_PASSWORD` and `UPSTASH_REDIS_URL` in it
     (see `ENVIRONMENT.md`). If `envFile` is set but the file is missing, the studio is not started, so it can never quietly use
     another website's settings.
2. Try it by hand, in PowerShell, from the app's folder:

```bash
powershell -ExecutionPolicy Bypass -File scripts\start-koboldcpp.ps1 -DryRun
powershell -ExecutionPolicy Bypass -File scripts\start-koboldcpp.ps1
```

   `-DryRun` starts nothing and prints what it would do (and how much VRAM is free). Switches: `-ImageOnly`, `-NoText`, `-ForceText`, `-Stop`.
3. Stop what it started: `powershell -ExecutionPolicy Bypass -File scripts\start-koboldcpp.ps1 -Stop`.

## Making it run at every start-up
Run this once, in a normal (not administrator) PowerShell, **signed in as the person whose computer it is**:

```bash
powershell -ExecutionPolicy Bypass -File scripts\install-koboldcpp-startup.ps1
```

It makes a Windows scheduled task called **Divination Station KoboldCpp** that runs the script 45 seconds after you sign in
(`-DelaySeconds 90` for longer). Try it without signing out with `Start-ScheduledTask -TaskName "Divination Station KoboldCpp"`.
Take it away with `scripts\install-koboldcpp-startup.ps1 -Remove`. To start only the image worker at sign-in, install with
`-ExtraArgs '-ImageOnly'`.

- **Anyone else's computer:** they do the same on their own computer: install KoboldCpp and a model (`docs/picture-model-at-home.md`),
  copy the example settings file and fix the paths, then run the install line. The task belongs to the Windows user who ran it, so each
  person who signs in on a shared computer would run it for themselves.
- **"At start-up" means "when you sign in".** KoboldCpp uses the graphics card through your desktop session, so it cannot start before
  anyone is signed in. If the computer should come back on its own after a power cut, turn on automatic sign-in (Windows key, type
  `netplwiz`, untick "Users must enter a user name and password"). That leaves the computer open to anyone who can touch it, so only
  do it on a computer in a place you trust. (On Windows 11 you may first need Settings > Accounts > Sign-in options > turn off
  "For improved security, only allow Windows Hello sign-in".)
- If the computer is asleep or the screen is locked at sign-in, it still runs once you are signed in.
- A second run is harmless: if port 5001 (or 5002) is already in use, the script says so and leaves that worker alone.

## If something goes wrong
| What you see | What it usually means |
|---|---|
| "Image worker: did NOT become ready" | Open `image.err.log` and `image.log` in the log folder. The commonest cause is a model path that no longer exists (set `image.model`). |
| "Text worker: NOT started, not enough free graphics memory" | Working as intended. See the numbers above; `-ForceText` tries anyway. |
| "Could not read the graphics memory" | Windows would not report it (some language versions of Windows name the counter differently). The text worker is then skipped unless you use `-ForceText`. |
| "Text worker: skipped. Router mode needs an admin password" | `COMPANION_PASSWORD` is not in the file named in `envFile`, and `text.adminPassword` is empty. |
| Nothing happens at sign-in | Open Task Scheduler, find the task, and look at its History / "Last Run Result". Check the task is still pointing at the script's folder (re-run the install line if you moved the app). |
| The log folder looks empty from inside the Claude desktop app | That app redirects its own programs' file writes to a private copy of `AppData\Local`. Look at the folder from File Explorer or an ordinary PowerShell window. |
