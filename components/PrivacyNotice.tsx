import Link from "next/link";
import { CRISIS_LINES } from "@/lib/crisis-lines";
import { shapeOf, type Shape } from "@/lib/edition";

// The privacy and terms text, in plain words. Written 2026-10-14 from docs/beta-tester-notice.md. The owner confirmed three promises on the same
// day (when they look at writing, no training, backups rotated within about 60 days) and they are in the text below. Only keep a promise here
// that will be kept. The 60 days matches scripts/backup-db.ts (newest 14 backups plus one a week for 8 weeks): if that changes, change the text.
// If you change the meaning of anything below, raise PRIVACY_VERSION in lib/privacy.ts so everyone reads it again.
//
// Three versions, one per kind of copy (lib/edition.ts shapeOf), because what is true differs (added 2026-10-22, a DRAFT for the owner's
// wording pass): the hosted site (the owner's database), a copy on one person's own computer ("local"), and a circle leader's copy that serves
// friends over Tailscale or Headscale ("host", docs/plan-host-mode.md point 6). The local one's backup counts match lib/local-backup-core.ts KEEP.

export const PRIVACY_UPDATED = "2026-10-26";

const H = ({ children }: { children: React.ReactNode }) => <h2 className="text-sm text-ink-soft font-semibold mt-6 mb-1">{children}</h2>;
const P = ({ children }: { children: React.ReactNode }) => <p className="text-sm text-ink-muted leading-relaxed">{children}</p>;

const CRISIS = CRISIS_LINES;

// Layered (owner's wording pass, 2026-10-26): each idea is said once. Part A is every copy (and the whole Feathered notice); Part B is what a
// Winged copy adds (Claude, then the companion, then pictures, then passkeys); Part C is what a copy that serves a circle adds; Part D is what
// the family website adds. Each person still reads one notice, made of the parts that fit their copy. Where a core idea differs by copy (where
// the writing is kept, the backups), Part A says it once in the words for that copy.

type Kind = "feathered" | "local" | "host" | "hosted";

const ownComputer = (k: Kind) => k === "feathered" || k === "local";

// ---- Part A: every copy -------------------------------------------------------------------------------------------------------------------

function Intro({ kind }: { kind: Kind }) {
  return (
    <P>
      {kind === "hosted"
        ? "Divination Station is a private beta, made and run by one person who believes that your own sense of things is worth tending. "
        : "This copy of Divination Station is "}
      {kind === "hosted" ? "It is " : ""}a place to write down your faintest impressions and keep them, so you can see for yourself how they turn
      out. Nobody here will tell you what a card, a stone, or a swing of the pendulum means. That is yours to find.
    </P>
  );
}

function WhereKept({ kind }: { kind: Kind }) {
  return (
    <>
      <H>{ownComputer(kind) ? "Where your writing is kept" : "Who can read what you write"}</H>
      {ownComputer(kind) && (
        <P>
          Everything you write stays in the my-data folder beside the app, on this computer or on your drive. The people who made the app cannot
          see it, and nothing is sent to them.
          {kind === "feathered"
            ? " This copy has no AI features and connects to nothing outside this computer; a link to a source or a help line opens only when you click it."
            : ""}
        </P>
      )}
      {kind === "host" && (
        <>
          <P>
            This copy runs on the computer of the person who hosts your circle, and you reach it through their private network (Tailscale or
            Headscale), not the public internet. Everything you write is stored on that computer and is not end-to-end encrypted, so the host can
            read it, and so can anyone who can open its files. The host can reset your password. If something is too private for that, keep it on
            paper.
          </P>
          <P>
            Words about your health, your body or your sex life are shown only to you, never to the circle, though they are stored like the rest.
          </P>
        </>
      )}
      {kind === "hosted" && (
        <>
          <P>
            On the website, your writing (and anything you type into the feedback box) is kept in a database the owner runs, not on your computer.
            It is not end-to-end encrypted, so the owner, or the company that hosts the database, could in principle read it, and a forgotten
            password can be reset. If something is too private for that, keep it on paper for now. The owner promises to look only if you ask for
            help or to keep the site safe, and never uses your writing to train anything.
          </P>
          <P>
            Words about your health, your body or your sex life are kept only for you, never shown to anyone else, and deleted with your account.
          </P>
          <P>
            The owner&rsquo;s actions on accounts (a password reset, switching an account off, deleting one, setting a limit, a decision on a
            reported forum post) are kept in a log only admins can read. It holds no passwords and none of your writing.
          </P>
        </>
      )}
    </>
  );
}

/** What counts as your writing: every kind, said once. The same on every copy. */
function WhatYouWrite() {
  return (
    <P>
      Your writing is everything you put in: journals, readings, notes, predictions, your own meanings, what you see in tea leaves and ink blots,
      your playing card, charm, signs and dreams records, your blind-target practice, and the takes on divination you write or keep. It also holds what you note before a reading is shown
      (&ldquo;Write what you sense first&rdquo;), how sure you felt and how well it later fitted, your tarot practice cards and your look-back
      reminders. All of it is in your export and is deleted with your account. If you turn on &ldquo;Keep trial facts&rdquo; in blind-target
      practice, one small row is also kept per trial (the kind of trial, the number of options, whether it was a hit, its place in your run and the
      week); turning it off deletes them. The example on the Patterns page is made up fresh each time and never saved, and the yearly review file is
      made from your own words only when you download it.
    </P>
  );
}

function Locking({ kind }: { kind: Kind }) {
  return (
    <>
      <H>Locking your writing</H>
      <P>
        When your writing is locked, it is one sealed file that nothing can read without your password, opened only in memory while you use it.
        Your pictures and backups are sealed the same way. When it is not locked, anyone who can open the folder can read it. Nobody can reset your
        password: a recovery code is the only way back in, and if you lose both, nobody can get your writing back.
        {kind === "local" ? " Locking is in Settings while this copy has only one account." : ""}
      </P>
    </>
  );
}

function QuickHide() {
  return (
    <>
      <H>The quick hide</H>
      <P>
        The quick hide signs you out at once, locks your writing and shows a small game in its place, so the Back button does not bring your
        writing back. Text you have not saved yet is lost.
      </P>
    </>
  );
}

function Age({ kind }: { kind: Kind }) {
  return (
    <>
      <H>Age</H>
      <P>
        The app is open to every age.{" "}
        {kind === "feathered"
          ? "The sensitive meanings (words that name abuse, sexual content or violence) are only for adults"
          : "The sensitive meanings (words that name abuse, sexual content or violence), the companion and the Claude buttons are only for adults"}{" "}
        and stay locked until you tick &ldquo;I am 18 or older&rdquo; in Settings. That answer is your own word; nobody checks it.
      </P>
    </>
  );
}

function Searching({ kind }: { kind: Kind }) {
  return (
    <>
      <H>Searching</H>
      <P>
        The search window looks only at your own writing and at what is shared with everyone. The words you type find results and are not saved. If
        you turn on recent searches (off until you do), the latest 20 searches you opened a result from are kept in your account for you alone and
        are never sent anywhere. Turning it off, or clearing them, deletes them.
        {kind === "host" || kind === "hosted" ? " The search also finds the forum posts you can already read." : ""}
      </P>
    </>
  );
}

function InTheBrowser({ kind }: { kind: Kind }) {
  return (
    <>
      <H>What stays in the browser</H>
      <P>
        A few choices live in this browser rather than in your writing: the speed of the pendulum, where the search looks, whether the side menu is
        narrow, your quick hide choices, a copy of your reading comfort settings (the settings themselves are kept with your account), and, if you
        leave it on, a short Recent list of the pages you last opened (cleared when you sign out). An unfinished picture form is saved here too, one
        per card, until you clear it. None of these is sent anywhere or in your export.
        {kind === "feathered"
          ? " The start file opens a private browser window that keeps these beside the app, not on the computer."
          : ""}
      </P>
    </>
  );
}

function NoAppCanHide() {
  return (
    <>
      <H>What no app can hide</H>
      <P>
        The computer may record that a program ran, though not what you did with it. A computer with monitoring software, or one run by a work or
        school, can see what is on the screen and what is typed. Use the app only on a computer you trust.
      </P>
    </>
  );
}

function Backups({ kind }: { kind: Kind }) {
  return (
    <>
      <H>Your choices and backups</H>
      <P>
        You can export everything you have written, and delete your account, at any time in Settings
        {kind === "hosted" ? " (it asks for your password again)" : ""}.{" "}
        Each of your readings keeps a count of how many times you opened it, so the calendar can show the reading of a day you went back to most. Only the
        count is kept, not when you opened it, and it goes when the reading is deleted.{" "}
        {ownComputer(kind) &&
          "The app keeps backups beside your writing: one a week (the newest seven), one before each update that changes the database (the newest three), and any you make with Back up now. Deleting your account does not reach backups made before; delete those files too if you want it gone from them."}
        {kind === "host" &&
          "The host’s backups hold everyone’s writing. Yours stays in backups made before you deleted it until they are replaced or the host deletes them."}
        {kind === "hosted" &&
          "The owner keeps backups of the whole database. They are rotated, so a deleted account is gone from them within about 60 days. The company that hosts the database also keeps a short history of its own."}
      </P>
    </>
  );
}

function Kindly({ kind }: { kind: Kind }) {
  return (
    <>
      <H>Using it kindly</H>
      <P>
        {kind === "hosted" ? "The owner can switch off an account that is being used to hurt people or to damage the site. " : ""}
        Divination tools are for reflection. Nothing here predicts your future for certain, and nothing here replaces a doctor, a lawyer, or a
        counsellor. {CRISIS}
      </P>
    </>
  );
}

// ---- Part B: what Winged adds (every copy but Feathered) ----------------------------------------------------------------------------------

function ClaudePart({ kind }: { kind: Kind }) {
  return (
    <>
      <H>Claude, the AI from Anthropic</H>
      <P>
        {kind === "local"
          ? "The Claude buttons work only once your own Claude key is in the settings file. "
          : kind === "host"
            ? "The Claude buttons work only once the host sets a key: their own, or one the circle adds. "
            : "Some buttons ask Claude for help. "}
        When you press one, the words involved are sent to Anthropic, the company that makes Claude, under that key, and Anthropic&rsquo;s rules
        for that account apply. Nothing is sent unless you press a button. When you ask Hiero to describe a concept in the Encyclopedia, only the
        concept&rsquo;s name and the cards it appears on are sent, never your writing; what Hiero writes is kept for you alone, in your export, and
        you can remove it.
      </P>
    </>
  );
}

function CompanionPart({ kind }: { kind: Kind }) {
  return (
    <>
      <H>The companion</H>
      <P>
        The companion is an AI, not a person. It works only once you turn it on in Settings and{" "}
        {kind === "local"
          ? "the settings file gives it a language model"
          : kind === "host"
            ? "the host has set up a language model, which the host chose"
            : "it runs on a language model on the owner’s own computer, not Anthropic"}
        . When you ask it something, the words from that reading go to that model and nowhere else, and you see the exact words first. It never
        reads what you wrote under &ldquo;Write what you sense first&rdquo; unless you tick &ldquo;Let the companion read these words&rdquo; on that
        reading.{kind === "hosted" ? " What it writes is saved only if you press Keep." : ""} It is not crisis support, and it does not give
        medical, legal or financial advice.
      </P>
    </>
  );
}

function PicturesPart({ kind }: { kind: Kind }) {
  return (
    <>
      <H>Pictures</H>
      <P>
        {kind === "local" &&
          "When you ask for pictures, the words you type go to the image program set up in the settings file, which draws what it is asked. Pictures you keep are files in your my-data folder."}
        {kind === "host" &&
          "When you ask for pictures, the words you type go to the image program the host set up, usually on their own computer, where they could read them. Pictures you keep are files on the host’s computer."}
        {kind === "hosted" &&
          "When you ask for pictures, the words you type go to an image program on the owner’s own computer, which draws what it is asked. Pictures you do not keep are deleted after a day, and pictures are made only while that computer is on."}
      </P>
    </>
  );
}

function PasskeysPart() {
  return (
    <>
      <H>Passkeys</H>
      <P>
        If you add a passkey, the app keeps its public half, its name and when it was added and last used. Your fingerprint, face or PIN never
        leaves your device. Passkeys are not in your export, are deleted with your account, and are removed when your password is reset.
      </P>
    </>
  );
}

// ---- Part C: a copy that serves a circle, and Part D: the family website ------------------------------------------------------------------

function CirclePart({ kind }: { kind: Kind }) {
  return (
    <>
      <H>{kind === "hosted" ? "Circles and the forum" : "The circle and its forum"}</H>
      <P>
        Being in a circle shares none of your journals, readings or notes: the others see only your name, what you post in the forum, and what you
        send in a letter. Everyone in
        the circle can read your posts{kind === "hosted" ? ", and so can the owner of this site; nobody outside the circle can" : ""}. The{" "}
        {kind === "hosted" ? "person who runs the circle" : "host"} can remove posts and comments. You can report a post; one that enough people
        report is hidden until {kind === "hosted" ? "the person who runs the circle, or the owner," : "the host"} has looked at it. Please do not
        post other people&rsquo;s private details, and do not use the forum to harass anyone.
        {" "}A letter is seen only by the two people it is between: the question the asker wrote, and the reader&rsquo;s letter with the one line
        naming their reading, if they chose one. The rest of that reading stays private. When the asker deletes a letter, it is gone for both of
        them; a reader who removes a letter they sent keeps it from their own list only.
        {kind === "hosted"
          ? " A circle’s leader may add their own Claude key and picture computer; they are used only if you agreed when you joined, and you can stop on the Circle page. Your circle is in your export."
          : ""}
      </P>
    </>
  );
}

function BetaPart() {
  return (
    <>
      <H>This is a beta</H>
      <P>
        Things will break and change. The Feedback button is there for exactly that, and for anything you wish were different. If this text changes
        in a way that matters, you will be asked to read it again.
      </P>
    </>
  );
}

/** One notice for one kind of copy: Part A, then whichever of Parts B, C and D fit it. */
function Layered({ kind }: { kind: Kind }) {
  const winged = kind !== "feathered";
  const circle = kind === "host" || kind === "hosted";
  return (
    <div className="space-y-1">
      <Intro kind={kind} />
      <WhereKept kind={kind} />
      <WhatYouWrite />
      {ownComputer(kind) && <Locking kind={kind} />}
      <QuickHide />
      <Age kind={kind} />
      <Searching kind={kind} />
      <InTheBrowser kind={kind} />
      {ownComputer(kind) && <NoAppCanHide />}
      <Backups kind={kind} />
      <Kindly kind={kind} />
      {winged && (
        <>
          <ClaudePart kind={kind} />
          <CompanionPart kind={kind} />
          <PicturesPart kind={kind} />
          <PasskeysPart />
        </>
      )}
      {circle && <CirclePart kind={kind} />}
      {kind === "hosted" && <BetaPart />}
    </div>
  );
}

const FeatheredNotice = () => <Layered kind="feathered" />;
const LocalNotice = () => <Layered kind="local" />;
const HostNotice = () => <Layered kind="host" />;
const HostedNotice = () => <Layered kind="hosted" />;

export default function PrivacyNotice({ shape = shapeOf() }: { shape?: Shape }) {
  const Notice = shape === "local" ? LocalNotice : shape === "host" ? HostNotice : shape === "feathered" ? FeatheredNotice : HostedNotice;
  return (
    <>
      <Notice />
      <p className="text-xs text-ink-ghost pt-4">
        Last updated {PRIVACY_UPDATED}. <Link href="/privacy" className="underline">Privacy and terms</Link> is always at this address.
      </p>
    </>
  );
}
