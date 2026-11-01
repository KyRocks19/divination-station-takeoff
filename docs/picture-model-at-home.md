# Making pictures at home: a beginner's guide

Written 2026-10-17 (open item C8). For the person who runs a circle (or the app) and wants their own computer to make the pictures that
people ask for. You do not need to know anything about AI. It takes about an hour the first time, mostly downloading.

**What happens.** When someone asks for a picture, the words they typed wait on the website. A small program on your computer, the
**picture studio**, takes them, hands them to an **image program** on the same computer (KoboldCpp), and sends the finished picture back.
Your computer only ever reaches **out** to the website; nothing on it can be reached from the internet.

**What you can see, and what you are responsible for.** The words people type for a picture pass through your computer, and the studio's
window prints a line for each one with the person's account number. Your computer will draw whatever it is asked, so tell the people
in your circle to keep their words to their own scenes. It cannot read anyone's readings or journals, and it never holds the database
password. Members can stop using your computer at any time.

## What you need
- A Windows computer with a graphics card (a gaming-type card, from the last several years). See "How big a card" below.
- About 10 GB of free disk space.
- [Node.js](https://nodejs.org) (the LTS version), and **the Picture Studio folder** (a small download; its own guide is
  `docs/picture-studio-download.md`, which it carries as `README.md`). The studio folder has a test, `check-picture-studio.cmd`, that
  says what is wrong in plain words. If you have a copy of the whole app's folder instead, run `npm install` once in it and use
  `start-picture-studio.cmd` there; `npx tsx scripts/image-worker.ts --check --picture` is the same test.
- A token for your computer (step 4).

## Step 1: the image program (KoboldCpp)
1. Go to KoboldCpp's releases page on GitHub (search for "koboldcpp releases") and download the Windows program. The newest release
   lists a few builds; the plain `koboldcpp.exe` works on both NVIDIA and AMD cards (it can use CUDA or Vulkan), and a "nocuda" build is a smaller
   download for AMD or Intel cards that uses Vulkan. If you are unsure, take `koboldcpp.exe`.
2. Put it in a folder of its own, for example `C:\Pictures\`. It is a single file; there is nothing to install.

## Step 2: a picture model (`.safetensors` files only)
The model is the file that knows how to draw. It is 2 to 7 GB.

- **Only download files that end in `.safetensors`.** Files ending in `.ckpt`, `.pt` or `.pth` can carry hidden code that runs when they
  are opened. A `.safetensors` file cannot. If a model is offered only as `.ckpt`, choose another model.
- A good first choice is a **Stable Diffusion 1.5** model such as *DreamShaper 8*: about 2 GB, and quick. Find it on Hugging Face or Civitai
  (search for the name and pick the `.safetensors` file). Read the model's licence on its page before you use it.
- Avoid the "XL" (SDXL) models to begin with: they need more memory and are many times slower (see below).
- Put the file next to KoboldCpp, for example `C:\Pictures\dreamshaper_8.safetensors`.

## Step 3: start KoboldCpp and make one test picture
1. Double-click `koboldcpp.exe`. A launcher window opens.
2. On the **Image Gen** tab, choose your `.safetensors` file as the image model. Leave the port at **5001**. (You can ignore the text-model
   boxes.)
3. Press **Launch**. A black window prints a lot of text and then says it is listening.
4. In your web browser, open `http://localhost:5001/sdui`, type a few words ("a quiet lake at dawn"), and make a picture. If a picture
   appears, this step is finished. Leave KoboldCpp running.

Starting it from a command line instead (the same thing): `koboldcpp.exe --sdmodel dreamshaper_8.safetensors --port 5001`.

## Step 4: a token for your computer
A token is a long secret that tells the website "this is that computer". It can only take waiting pictures and send them back.
- **If you run a circle:** open **Your circle** on the website and, under "Your picture computer for this circle", give the computer a name
  and press **Add a picture computer**. Copy the token it shows: it appears **once**.
- **If you run the app:** open **Admin > Picture computers** (`/admin/workers`) and make a token the same way.

Then, in the app's folder, make or open the file `.env.local` and add these lines (the website's address is the one you type in your browser):

```
APP_URL=https://the-websites-address
WORKER_TOKEN=dsw_paste-the-token-here
IMAGE_GEN_URL=http://localhost:5001
```
Never share the token, post it, or put it anywhere but this file. If it leaks, remove the computer on the website and make a new one.

## Step 5: start the studio
Double-click `start-picture-studio.cmd` in the app's folder. A window opens and prints the website's address and your computer's name. It
should say it is a circle's picture computer if you made the token on the Circle page. Leave it open. Closing it (or Ctrl+C) puts the
studio to sleep, and the website says so.

- Start KoboldCpp **first**, then the studio.
- **Pictures can wait a few minutes.** A circle's computer looks at the queue about every 10 minutes (it has no instant "doorbell"; that
  belongs to the app's own computer). Please do not make it look much more often: every look keeps the app's free database awake and uses up its
  monthly allowance. If you must change it, ask the person who runs the app first (`WORKER_IDLE_POLL_SECONDS` in `.env.local`).
- Members see "asleep" on the picture maker while the studio is closed, and their pictures wait up to 24 hours.

## Step 6 (optional): start it all by itself
Tired of starting KoboldCpp by hand? `docs/koboldcpp-startup.md` has a script that starts KoboldCpp (and the text model, if the card has room)
and a one-line install that does it every time you sign in to Windows.

## How big a card
I can only tell you what I have measured: a 12 GB AMD card (RX 6700 XT) with DreamShaper 8 made a 512 by 512 picture in about 14 seconds,
and an SDXL model on the same card took about 2 minutes for a picture slightly bigger. KoboldCpp's own notes suggest 8 GB of graphics memory for
its bundled image pack, and give no smaller figure. If your card has less, try anyway; two switches help with memory: `--sdquant` (a lighter
copy of the model) and `--sdoffloadcpu` (moves idle parts off the card). Without a graphics card it can run on the processor
(`--usecpu`), but it will be very slow; I have not tried that. If the first test picture takes more than a few minutes, this computer is probably
too slow to be useful.

## Other image programs (optional)
KoboldCpp is not the only program that works. Each studio chooses its own in `.env.local`; nothing changes on the website.

- **AUTOMATIC1111, Forge or SD.Next.** These answer the same way KoboldCpp does. Start the program with its API switched on (for
  AUTOMATIC1111 and Forge, add `--api` to its start-up line), and set `IMAGE_GEN_URL` to its address, usually `http://localhost:7860`.
  Nothing else is needed. "Make larger" works if an upscaler is set up in that program.
- **ComfyUI.** Add three lines (ComfyUI usually listens on port 8188):
  ```
  IMAGE_GEN_URL=http://localhost:8188
  IMAGE_GEN_KIND=comfyui
  IMAGE_GEN_MODEL=dreamshaper_8.safetensors
  ```
  `IMAGE_GEN_MODEL` is the file name of a model in ComfyUI's `models/checkpoints` folder, written exactly as ComfyUI lists it. The studio
  sends ComfyUI its own plain text-to-picture graph. Pictures go to ComfyUI's temporary folder, which it empties when it restarts, not to its
  output folder. "Make larger" is not offered with ComfyUI.

Run the test (`check-picture-studio.cmd`) after any change. If the address answers like a different kind of program from the one set, the test
says which one and what to write.

## SDXL models at their own size (optional, off unless set)
The studio normally asks for pictures of about 512 by 512 (512 by 704 for a card), the size Stable Diffusion 1.5 models were made for. An SDXL
model asked for that size draws worse pictures. Add `IMAGE_GEN_SIZE=sdxl` to ask for its own size instead: 832 by 1152 for a card, 1024 by
1024 for a stone or a charm, 512 by 2048 for a stave. The pictures are better and take longer; the studio keeps them at most 1024 on their
longest side, as before.

- Measured on the owner's card (RX 6700 XT, 12 GB) at the smaller size: about 2 minutes per SDXL picture, or 83 to 100 seconds with SD Flash
  Attention and Conv2D Direct switched on in KoboldCpp. The SDXL size has about twice as many pixels, so expect it to be slower than that;
  it has not been timed yet. Time one with the test (`check-picture-studio.cmd`, which makes a test picture and says how long it took).
- If each picture takes many minutes, raise `IMAGE_GEN_TIMEOUT_SECONDS` (up to 3600), or try a fast SDXL model ("Lightning", "Turbo" or
  "Hyper" in its name) with the steps and guidance its page asks for, for example `IMAGE_GEN_STEPS=6` and `IMAGE_GEN_CFG=2`.
- Leave the line out to go back to the standard sizes. It changes only the pictures this studio makes.

## If something goes wrong
| What you see | What it usually means |
|---|---|
| The studio says the token was not accepted | The token is mistyped, was removed, or `APP_URL` is wrong. Make a new token. |
| It says `APP_URL must start with https://` | Add the `https://`. (`http://` is only allowed for this same computer.) |
| "Nothing to do: set IMAGE_GEN_URL" | The `IMAGE_GEN_URL=http://localhost:5001` line is missing from `.env.local`. |
| Pictures fail with "could not reach the image tool" | KoboldCpp is not running, or is on another port. Start it first. |
| A picture fails with "took too long" | The model is too heavy for this card. Try a smaller model. |
| The studio is running but nothing arrives | It looks about every 10 minutes. Wait, or check that the person asking has agreed to use your computer (their Circle page). |
| The website says your computer is asleep | The studio window is closed or the computer slept. Start the studio again. |

## Taking it down
Remove the computer on the Circle page (or revoke the token at `/admin/workers`). The studio stops at once. Pictures people were waiting
for are given up with a plain message and they can ask again.

See also `docs/picture-queue.md` for how the queue, the limits and the tokens work.
