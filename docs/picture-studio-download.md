# Picture Studio: lend your computer to your circle

This folder is the **Picture Studio**, a small program for the person who runs a circle in Divination Station. When someone in your circle asks the app for a picture, the words they typed wait on the website. The studio takes them, hands them to an image program on **your** computer, and sends the finished picture back. Your computer only makes connections **out** (to the website and to the image program on the same computer). Nothing on it can be reached from the internet, and the studio never holds the database password.

**What you are responsible for.** The words people type for a picture pass through your computer, and the studio's window prints one line for each, with the person's account number. Your computer will draw whatever it is asked, so tell the people in your circle to keep their words to their own scenes. The studio cannot read anyone's readings or journals. People can stop using your computer at any time, and you can stop it at any time.

**Is this the whole app?** No. This is only the picture helper. It needs a circle on the website and a token from that circle. If you want a copy of the whole app that keeps everything on your own computer, that is a separate download.

## What you need
- A computer with a graphics card made in the last several years, and about 10 GB of free disk space.
- [Node.js](https://nodejs.org), the version marked LTS (version 20 or newer).
- An image program. These steps use KoboldCpp, which is free and is one file.
- A token for your computer (step 4). You get it from the website, on the Circle page.

## Step 0: check the download (optional, takes a minute)
The person who gave you this folder published a **checksum** for the zip file. It is a long line of letters and digits that changes if even one byte of the file changes. On Windows, open PowerShell and run (with your file's name):

    Get-FileHash -Algorithm SHA256 .\picture-studio.zip

If the line it prints is not the same as the published one, do not use the file. Inside the folder, `SHA256SUMS.txt` lists the checksum of every file in the same way.

## Step 1: the image program
1. Search for "koboldcpp releases" on GitHub and download the Windows program. `koboldcpp.exe` works on NVIDIA and AMD cards. Put it in a folder of its own, for example `C:\Pictures\`. There is nothing to install.
2. Download a picture model. **Only download files that end in `.safetensors`.** Files ending in `.ckpt`, `.pt` or `.pth` can hide code that runs when they are opened. A good first choice is a Stable Diffusion 1.5 model such as DreamShaper 8 (about 2 GB). Read the model's licence on its page. Put the file next to KoboldCpp.
3. Double-click `koboldcpp.exe`. On the **Image Gen** tab choose the model file, leave the port at **5001**, and press **Launch**.
4. In your browser open `http://localhost:5001/sdui`, type a few words and make a picture. If a picture appears, this step is done. Leave KoboldCpp running.

A fuller guide to this step, with what to do if a card is small, is in the app's source (`docs/picture-model-at-home.md`).

## Step 2: install the studio's one library
Unzip this folder somewhere you will remember. Open a terminal in the folder (Windows: in File Explorer, click the address bar, type `cmd` and press Enter). Run this once:

    npm install

It downloads `sharp`, the library that shrinks each picture before it is sent back.

## Step 3: make a token
On the website, open **Your circle**. Under "Your picture computer for this circle", give the computer a name and press **Add a picture computer**. Copy the token it shows. **It appears only once.**

## Step 4: put the settings in `.env.local`
Copy the file `.env.example` to a new file named `.env.local` (same folder). Open it in Notepad and fill in:

    APP_URL=https://the-websites-address
    WORKER_TOKEN=dsw_paste-the-token-here
    IMAGE_GEN_URL=http://localhost:5001

Using AUTOMATIC1111, Forge or SD.Next instead of KoboldCpp? Put its address in `IMAGE_GEN_URL` (usually `http://localhost:7860`, started with `--api`). Using ComfyUI? Also add `IMAGE_GEN_KIND=comfyui` and `IMAGE_GEN_MODEL=` followed by the model's file name in its `models/checkpoints` folder. For an SDXL model, `IMAGE_GEN_SIZE=sdxl` asks for pictures at its own size (better, slower). The full guide to these is "Other image programs" and "SDXL models at their own size" in `docs/picture-model-at-home.md` in the app's source.

The website's address is the one you type in your browser, without anything after the slash. **Never share this file or the token, and never post them anywhere.** If the token leaks, remove the computer on the Circle page and make a new one.

## Step 5: test it
Double-click `check-picture-studio.cmd` (Mac or Linux: `./check-picture-studio.sh`). It checks the settings, asks the website whether the token is accepted, asks the image program whether it answers, and makes **one test picture** that it throws away. It changes nothing on the website. Each line says OK or PROBLEM, and each problem says what to do. When every line says OK, go on.

## Step 6: start it
Start KoboldCpp first, then double-click `start-picture-studio.cmd` (Mac or Linux: `./start-picture-studio.sh`). A window opens and says the website's address and your computer's name; it says it is a circle's picture computer. Leave it open. Closing it, or pressing Ctrl+C, puts the studio to sleep, and the website says so.

- **Pictures can wait a few minutes.** A circle's computer looks at the queue about every 10 minutes. Please do not make it look much more often: each look keeps the app's free database awake and uses up its monthly allowance.
- While the studio is closed, members see "asleep" on the picture maker, and their pictures wait up to 24 hours.

## If something goes wrong
Run the test (step 5) first. It says which part is the problem. The most common causes:

| What you see | What it usually means |
|---|---|
| The website did not accept the token | The token is mistyped or was removed. Make a new one. |
| APP_URL must start with https:// | Add the `https://`. (`http://` is only allowed for this same computer.) |
| No answer from the image program | KoboldCpp is not running yet, or uses another port. Start it first. |
| "answers like ComfyUI" (or like KoboldCpp) | The address is right but `IMAGE_GEN_KIND` is not. Write what the test says. |
| "No model called ..." | `IMAGE_GEN_MODEL` does not match a file ComfyUI has. The test lists the ones it has. |
| The test picture takes more than a few minutes | This computer is probably too slow for a picture model like this. Try a smaller model. |
| The studio runs but nothing arrives | It looks about every 10 minutes. Check that the person asking has agreed to use your computer (their Circle page). |
| "npm" is not recognised | Install Node.js (see "What you need"), then open a new terminal. |

## Taking it down
Remove the computer on the Circle page. The studio stops at once. Pictures people were waiting for are given up with a plain message, and they can ask again. Then delete this folder.

## What this is
The studio is part of Divination Station, which is free software under the GNU AGPL v3. `LICENSE` and `NOTICE` in this folder have the licence and the credits for the libraries inside `studio.mjs`. `VERSION.txt` says which version of the source this was built from.
