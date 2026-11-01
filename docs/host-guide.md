# Hosting a circle on your own computer

This is for a circle leader who is comfortable with a terminal and a private network. Your copy of Divination Station runs on your computer as usual, and the friends in your circle reach it through Tailscale or Headscale. Nothing is put on the public internet.

Written 2026-10-22 (open item H2). The two-account test in `docs/host-mode-tailscale-test.md` (H2.0) has not been run yet, so the Tailscale steps below are the plan, not a checked recipe. Headscale has not been tried at all.

## Before you start: what you take on
- **You can read what your friends write.** Everything they write is stored on your computer, in your `my-data` folder, without end-to-end encryption. The app tells them so before they join and in its privacy text. Be the kind of host they can trust with that.
- **Your computer serves other people.** Keep the operating system and the app up to date, and keep the computer awake while friends use it.
- **Backups hold everyone's writing.** The weekly backups and "Back up now" (Settings, Backups) are in `my-data.backups` beside the data folder. Keep them as private as the data.
- **Young people.** If anyone under 18 may join, read section 5 before you invite them.
- **One computer serves everyone.** One database session and one picture program are shared, so a big circle waits more. The circle holds 10 people unless you change it (below), and at most 30.

## 1. Start your copy in host mode
**A shortcut, if you build the app yourself:** `npx tsx scripts/build-local-package.ts --host --circle-max 10` makes a folder named `divination-station-host-<computer>` with steps 2 and 3 already done: its `settings.env` turns host mode on. It also holds `JOIN-MY-CIRCLE.md`, the note to send your friends. Start it, make your account (step 1), then go on from step 3.

1. Set up the portable folder or Docker as in `README.md`, start it once, and make your own account at `http://localhost:47831`. Only you can do this, and only from this computer. You are the circle's admin.
2. Stop it. Copy `settings.example.env` to `settings.env` and set:

       DS_MODE=host
       # optional, 2 to 30:
       DS_HOST_CIRCLE_MAX=10

   With Docker, set the same in `docker-compose.yml` under `environment`.
3. Start it again. The Circle, Forum and Join pages are now there, and **Host a circle** (`/host`, in the Admin menu) walks you through the rest of this guide. Open it at `http://localhost:47831/host`: it only works from this computer.
4. Make the circle on the Circle page and a circle code for your friends.

The app still listens on `127.0.0.1` only. Your private network forwards to it; nothing else on your local network can reach it.

## 2. Tailscale (a free plan suits a small circle)
1. Install Tailscale and sign in. Run `tailscale status` to check.
2. Run `tailscale serve --bg 47831`. It prints an address such as `https://my-pc.tail1234.ts.net`. Paste it into step 4 of **Host a circle**. It works within a few seconds, without a restart.
3. Run `tailscale serve status`: it must show the address forwarding to `http://127.0.0.1:47831` and **no Funnel line**. Never use `tailscale funnel` for this; it makes the app public. If Funnel is on, run `tailscale funnel reset`.
4. In the admin console (Machines, the computer's menu, **Share**) share this computer with each friend's Tailscale account. Each friend accepts the share and opens the address.
5. Check what a shared friend can reach. A shared machine may expose more than one port to the friend; if you run other services on this computer, limit the friend to port 443 with an access rule, or move those services. (H2.0, question 2, answers this exactly.)

The owner's note of 2026-10-22: a free Tailscale plan suits about 6 people. Check Tailscale's current plan limits for users and sharing before you invite more.

## 3. Headscale (larger circles)
Headscale is a control server you run yourself, so the size of the circle is up to you.
1. Run Headscale, join this computer and each friend's devices to it, and use its access rules so friends reach only this computer, and only the app's port.
2. **The app needs HTTPS.** Its sign-in cookie is sent only over HTTPS when it runs as a release build, so a plain `http://` address will not keep anyone signed in. Put an HTTPS reverse proxy (Caddy or nginx, with a certificate for the name your friends use) in front of `http://127.0.0.1:47831`, reachable only on the Headscale network. `tailscale serve` may not get a certificate under Headscale.
   **The proxy must pass on who is asking.** The app keeps a few things for you alone (first set-up, Host a circle, Stop the app, Move my data) and tells you from a friend by the request's name and the `X-Forwarded-For` header a proxy adds. Caddy's `reverse_proxy` does this by itself. With nginx, add both lines to the `location` block, or a friend's request looks as if it came from this computer:

       proxy_set_header Host $host;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
3. Paste that name into step 4 of **Host a circle**, and share the address and a circle code.

## 4. What each friend does
Friends do not download the app: a phone or a small computer with a browser is enough. Send each friend `docs/join-a-circle.md` (`JOIN-MY-CIRCLE.md` in a host folder) with your address and a circle code.
1. Install Tailscale (or join your Headscale network), and accept your share.
2. Open the address you gave them, choose **I have an invite code** on the sign-in page, and enter the circle code, a username and a password.
3. Read "Before you join: what goes where". It starts by saying that your computer stores what they write and that you can read it. They agree, and they are in.

## 5. Young people and age-appropriate content
The app is open to every age (decided 2026-10-22). What it does by itself, and what is left to you:

**What the app does**
- Each person says for themselves whether they are 18 or older (Settings, "I am 18 or older"). It is off until they tick it, and it is their word: the app does not check anyone's age.
- Until it is ticked, the sensitive concepts (abuse, sexual content and similar themes in the encyclopedia, search and the concept graph) are hidden, and the AI features are off: the companion, the Claude buttons and the interviewer.
- Everyone, signed in or not, can open **If you are struggling** (`/help`, linked at the foot of every page). It lists crisis lines. The companion is adults-only, so this page is where a younger person finds them.

**What the app does not do**
- The forum is not filtered. A post or comment in your circle is shown to every member whatever their age, including words written by adults.
- Nobody's private readings or journals are shown to anyone else. As host, though, you can read everything on your computer (see "Before you start").

**What you take on when someone under 18 joins**
- Decide before you invite them. A circle with a young person in it is a circle where everyone writes for a young reader. Tell the adults that before the young person joins, and agree what is not posted (sexual content, self-harm detail, drugs, anything you would not say in front of them).
- Ask a parent or carer. For anyone under 16, get a parent's or carer's agreement first; in many countries the law expects it for an online service that stores a child's writing. Keep it simple: tell them what the app stores, that it is on your computer, and that you can read it.
- Do not invite anyone under 13. Most countries' online-privacy laws set extra rules below 13, and the app is not built for them.
- Be a host they can trust. You can read what they write. Read it only when you need to (a report, or a worry about their safety), and never share it.
- If a young person writes something that worries you for their safety, talk to them and to a trusted adult in their life, and in danger call the local emergency number. The **If you are struggling** page lists lines for young people too.
- If an adult in the circle posts something unsuitable, delete it (section 7) and talk to them. If it is a threat to a child, take them out of the circle (section 8), keep a copy of what they posted, and report it to the police.

## 6. Updating the app
Your friends' writing is in `my-data`, not in the app folder, so an update does not touch it.
1. Tell the circle the app will be down for a few minutes.
2. Make a backup first: Settings, Backups, **Back up now**. Copy that file off the computer too.
3. Close the app (or `docker compose down`).
4. Portable folder: unzip the new version to a new folder, then move `my-data` and your `settings.env` into it. Docker: put the new version's files in your folder (keep your `docker-compose.yml` changes) and run `docker compose up --build`; the data stays in the `ds-data` volume. Never use `docker compose down -v`, which deletes it.
5. Start it again. It brings its database up to date by itself the first time. If the window says the data folder is already open, the old copy is still running: close it first.
6. Open the app yourself and check that it starts, then tell the circle. Your Tailscale or Headscale address stays the same, so nobody needs a new link.

Keep the old folder until you have checked the new version works; then delete it. `UPGRADING.md` has more on what the first start does and how to go back.

## 7. Reports and the forum
- Anyone can report a post or comment that is not their own. Once enough different people report it (a quarter of the circle, at least 2 and at most 5), it is hidden from everyone but its author and you.
- The forum shows you a line ("reported items are waiting for you") that leads to the reports list (`/forum/reports`). For each item, **Keep it up** shows it again and closes its reports; **Delete** removes it.
- You can delete any post or comment in your circle, reported or not. You cannot change anyone's words: only the author edits their own writing (decided 2026-10-22).
- The person who reports is never told whether their report hid the item.

## 8. Taking someone out of the circle
1. On the Circle page, press **Remove** beside their name. They no longer see the circle or its forum. Nothing of theirs is deleted, and what they posted stays until you delete it.
2. Stop them reaching your computer. Tailscale: in the admin console (Machines, the computer's menu, **Share**), remove their share. Headscale: remove their devices or their access rule.
3. If they should not sign in at all, switch their account off (Admin, Users, **Switch off**). **Delete** removes their account and everything they wrote on your copy. Do this only if they ask, or after you have given them a chance to export their writing (Settings, Export).
4. If you shared a circle code with them, make a new one and stop the old one.

## 9. Backups and restoring
- The app makes a backup of everything every week by itself. **Back up now** (Settings, Backups) makes one at once. The files are in `my-data.backups` beside your data folder.
- A backup on the same disk does not help if the disk fails. Copy the files somewhere else regularly (an external drive or another computer), and keep them as private as the data: they hold everyone's writing.
- **To restore:** Settings, Backups, **Restore…** beside the backup you want, then **Replace everything with this backup**. Everything in the copy is replaced with that backup, so whatever anyone wrote after it was made is gone from the copy. What is there now is saved as its own backup first, so you can go back. You are signed out.
- Tell the circle before you restore, and which day it goes back to, so they know what they need to write again.
- **A backup from another computer:** put its file in the backups folder and reload the Backups page; it shows in the list.
- **The whole computer is lost:** set up the app on a new computer (section 1), put your copied backup file in its backups folder, and restore it. Your account and your friends' accounts come back with it. Then set up Tailscale or Headscale again and give the circle the new address.

## If something goes wrong
- **"This address is not one this copy of the app answers to" (421):** the name in the browser is not one you saved on **Host a circle**. Save exactly that name. (A name in `ALLOWED_HOSTS` in `settings.env` works too, after a restart; the page keeps up to 5.)
- **Signed out again at once:** the address is `http://`, not `https://` (see 3.2).
- **"This circle is full":** raise `DS_HOST_CIRCLE_MAX` (at most 30) and restart.
- **The window says the data folder is already open:** another copy is running on the same `my-data`. Close it first.
