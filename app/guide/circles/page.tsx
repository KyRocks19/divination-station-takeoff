import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { BackLink, JumpLinks, Page, PageTitle } from "@/components/ui/Page";
import { Card } from "@/components/ui/Card";
import { editionName, hostCircleMembers, HOST_CIRCLE_MEMBERS_LIMIT, isLocalEdition, shapeOf } from "@/lib/edition";
import { FeatheredAlone, FullCircle, SmallCircle, TwoHosts } from "@/components/circles/CirclePictures";

export const metadata = { title: "Circles and Tailscale" };

// How the two editions differ in who can reach them: Feathered alone first, then Winged host mode, circles and Tailscale, each explained once
// at first mention (owner's wording rule, 2026-10-26). Grounded in docs/host-guide.md and docs/join-a-circle.md; change them together.
// Draft words for the owner's wording pass.
export default async function CirclesGuidePage() {
  const session = await getSession();
  if (!session.userId) redirect("/login?from=/guide/circles");
  const shape = shapeOf();
  const name = editionName(shape);
  const showHostLink = session.isAdmin && isLocalEdition() && shape !== "feathered";

  return (
    <Page>
      <BackLink href="/guide">← How this works</BackLink>
      <PageTitle>Circles and Tailscale</PageTitle>
      <p className="text-sm text-ink-soft leading-relaxed">
        Divination Station comes in two editions, Feathered and Winged. This page shows who can reach each one, and what a circle
        is.{name && <> This copy is the {name} edition{shape === "host" ? ", in host mode" : ""}.</>}
      </p>
      <JumpLinks
        items={[
          { id: "feathered", label: "Feathered" },
          { id: "winged", label: "Winged and circles" },
          { id: "tailscale", label: "Tailscale" },
          { id: "two-hosts", label: "More than one circle" },
          { id: "what-goes-where", label: "What goes where" },
        ]}
      />

      <section id="feathered" aria-labelledby="feathered-h" className="space-y-3">
        <h2 id="feathered-h" className="text-lg font-semibold text-ink-strong">Feathered: on your own</h2>
        <figure className="space-y-2">
          <FeatheredAlone />
          <figcaption className="text-xs text-ink-faint">One Feathered copy, and nobody else.</figcaption>
        </figure>
        <p className="text-sm text-ink-soft leading-relaxed">
          The Feathered edition is the copy for one person. It runs on your computer or a flash drive and keeps everything you write in
          the <code>my-data</code> folder beside the app. It has no AI features, no circle and no forum, and it never connects to the
          internet. Nobody else can open it, not even someone on the same Wi-Fi: it answers only to the computer it runs on.
        </p>
      </section>

      <section id="winged" aria-labelledby="winged-h" className="space-y-3">
        <h2 id="winged-h" className="text-lg font-semibold text-ink-strong">Winged: a host and their circle</h2>
        <figure className="space-y-2">
          <SmallCircle />
          <figcaption className="text-xs text-ink-faint">One host and three friends.</figcaption>
        </figure>
        <p className="text-sm text-ink-soft leading-relaxed">
          The Winged edition is the full copy: everything in Feathered, plus optional AI features and host mode. With host mode on,
          the copy also serves a <strong>circle</strong>, a group of friends who share a forum. The person whose computer runs it is
          the <strong>host</strong>. A host turns host mode on by setting <code>DS_MODE=host</code> in the copy&apos;s{" "}
          <code>settings.env</code> file. A circle holds {hostCircleMembers()} people unless the host changes it, and at
          most {HOST_CIRCLE_MEMBERS_LIMIT}.
        </p>
        <p className="text-sm text-ink-soft leading-relaxed">
          Friends do not download the app. They open it in a browser on a phone, a tablet, a laptop or a desktop computer, and the
          host&apos;s computer does the work, so a small or old device is fine. The host&apos;s computer has to be on and awake while
          friends use it.
        </p>
        <figure className="space-y-2">
          <FullCircle />
          <figcaption className="text-xs text-ink-faint">One host and nine friends in different time zones.</figcaption>
        </figure>
      </section>

      <section id="tailscale" aria-labelledby="tailscale-h" className="space-y-3">
        <h2 id="tailscale-h" className="text-lg font-semibold text-ink-strong">Tailscale: how friends reach the host</h2>
        <p className="text-sm text-ink-soft leading-relaxed">
          A circle is never on the public internet. Friends reach the host&apos;s computer through <strong>Tailscale</strong>, a free
          private network: an app that joins chosen devices together over the internet, so that they can reach each other and
          nobody else can reach them.
        </p>
        <Card className="space-y-2">
          <ol className="list-decimal pl-5 space-y-1.5 text-sm text-ink-soft leading-relaxed">
            <li>The host installs Tailscale on the computer that runs the app, and gives it an address that only the network can open, such as <code>https://their-pc.tail1234.ts.net</code>.</li>
            <li>Each friend installs Tailscale on their device, makes an account and tells the host its email address.</li>
            <li>The host shares the computer with that account, and the friend accepts the share.</li>
            <li>The friend opens the address in a browser, chooses <strong>I have an invite code</strong>, and enters the circle code from the host with a username and a password.</li>
          </ol>
        </Card>
        <p className="text-sm text-ink-soft leading-relaxed">
          A free Tailscale plan suits a small circle. For a larger one, a host can run <strong>Headscale</strong>, a server for the same
          kind of private network that they run themselves. Hosting is for people who are comfortable with a terminal: the step-by-step
          guide is <code>HOSTING.md</code> in the Winged download, and friends get <code>JOIN-MY-CIRCLE.md</code>.
          {showHostLink && (
            <>
              {" "}On this computer, <Link href="/host" className="text-accent-ink hover:text-accent-ink-hover underline">Host a circle</Link> walks through it.
            </>
          )}
        </p>
      </section>

      <section id="two-hosts" aria-labelledby="two-hosts-h" className="space-y-3">
        <h2 id="two-hosts-h" className="text-lg font-semibold text-ink-strong">More than one circle</h2>
        <figure className="space-y-2">
          <TwoHosts />
          <figcaption className="text-xs text-ink-faint">Two hosts, each with a circle, and one friend in both.</figcaption>
        </figure>
        <p className="text-sm text-ink-soft leading-relaxed">
          Each host&apos;s copy serves its own circle, and two hosts&apos; copies share nothing with each other. A friend can join more
          than one circle. Each one has its own address and its own account, and what they write in one circle stays on that
          host&apos;s computer.
        </p>
        <p className="text-sm text-ink-soft leading-relaxed">
          Nothing moves between hosts by itself. To carry a circle&apos;s forum from one host to another, the host opens the Forum page, chooses
          &ldquo;Save the forum to a file&rdquo;, and gives the file to the other host, who chooses &ldquo;Bring in a forum file&rdquo; on their
          Forum page. The other host sees what would be added before anything is. Bringing a file in only adds, so doing it twice makes no
          copies and nothing is deleted. A person&apos;s own readings and journals are not in that file; they move with the person&apos;s own export
          file from Settings.
        </p>
      </section>

      <section id="what-goes-where" aria-labelledby="what-goes-where-h" className="space-y-3">
        <h2 id="what-goes-where-h" className="text-lg font-semibold text-ink-strong">What goes where in a circle</h2>
        <ul className="list-disc pl-5 space-y-1.5 text-sm text-ink-soft leading-relaxed">
          <li>Everything a friend writes (readings, journal entries, forum posts) is stored on the host&apos;s computer, not on the friend&apos;s device.</li>
          <li>It is not end-to-end encrypted, so <strong>the host can read it</strong>. Join only a circle whose host you trust with your writing.</li>
          <li>Private readings and journals are never shown to the other members. Forum posts and comments are shown to everyone in the circle.</li>
          <li>The app says this again before anyone joins, under &ldquo;Before you join: what goes where&rdquo;.</li>
        </ul>
      </section>

      <p className="text-sm text-ink-muted">
        <Link href="/guide" className="underline">How this works</Link>
        {" · "}
        <Link href="/privacy" className="underline">Privacy and terms</Link>
      </p>
    </Page>
  );
}
