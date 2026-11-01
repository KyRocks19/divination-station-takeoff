import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { BackLink, Page, PageTitle } from "@/components/ui/Page";
import { editionName, shapeOf } from "@/lib/edition";
import { APP_VERSION, SOURCE_URL } from "@/lib/app-version";

// Placeholder wording: the person who made the app will write the real About page. Until then it holds the draft
// dedication from the project notes and nothing else.
export default async function AboutPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  return (
    <Page>
      <BackLink href="/">← Home</BackLink>
      <PageTitle>About</PageTitle>
      <p className="text-sm text-ink-muted leading-relaxed">
        This app is meant to offer tools for intuition sharpening, and a mirror for you to peer at your deepest recesses with. Divination Station is dedicated
        to Hekate, keeper of keys and crossroads, light-bringer before the gate. It is also dedicated to every real-life person who&rsquo;s work made it
        possible for this young seeker to find her path, including but not limited to all the Primary Sources available in this app&rsquo;s Sources page. Thank
        you especially to Felix G., Sasha B., Natalie M., Ashley P., and all the spirits in my house: all of whom helped me stay grounded and sane during this
        app creation process
      </p>
      {/* Which edition this copy is (docs/plan-feathered-edition.md). Draft words for the owner's wording pass. */}
      {editionName() && (
        <p className="text-sm text-ink-muted">
          This copy is the {editionName()} edition.{" "}
          {shapeOf() === "feathered"
            ? "It has no AI features and connects to nothing outside this computer. To add circles or the AI companion, download the Winged edition and run its upgrade file."
            : "It runs on your own computer."}
        </p>
      )}
      <p className="text-sm text-ink-muted">
        Version {APP_VERSION}. The code is free software under the GNU AGPL, version 3.{" "}
        <a href={SOURCE_URL} className="underline" target="_blank" rel="noopener noreferrer">
          Source code<span className="sr-only"> (opens in a new tab)</span>
        </a>
      </p>
      <p className="text-sm text-ink-muted">
        <Link href="/privacy" className="underline">
          Privacy and terms
        </Link>
        {" · "}
        <Link href="/guide" className="underline">
          How this works
        </Link>
        {" · "}
        <Link href="/guide/circles" className="underline">
          Circles and Tailscale
        </Link>
        {" · "}
        <Link href="/sources" className="underline">
          Sources
        </Link>
        {" · "}
        <Link href="/help" className="underline">
          If you are struggling
        </Link>
      </p>
    </Page>
  );
}

export const metadata = { title: "About" };
