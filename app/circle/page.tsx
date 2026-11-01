import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Page, PageTitle } from "@/components/ui/Page";
import CirclePanel from "@/components/CirclePanel";
import { isHostMode } from "@/lib/edition";

// The person's circle: a household or friend group (migration 063). The API checks everything again; this page only needs a signed-in person.
export default async function CirclePage() {
  const session = await getSession();
  if (!session.userId) redirect("/login?from=/circle");

  return (
    <Page>
      <PageTitle>Your circle</PageTitle>
      <CirclePanel host={isHostMode()} />
      <p className="text-sm text-ink-muted">
        <Link href="/guide/circles" className="underline">How circles and Tailscale work</Link>
      </p>
    </Page>
  );
}

export const metadata = { title: "Your circle" };
