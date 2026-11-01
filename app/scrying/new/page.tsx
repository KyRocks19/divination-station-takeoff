import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { isScryingSurface } from "@/lib/scrying";
import ScryingRoom from "@/components/scrying/ScryingRoom";
import { BackLink, Page, PageTitle } from "@/components/ui/Page";

export default async function NewScryingSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ surface?: string }>;
}) {
  const { surface } = await searchParams;
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const prefs = await getPrefs(session.userId);

  return (
    <Page>
      <BackLink href="/scrying">
        ← Scrying
      </BackLink>
      <PageTitle>Open a surface</PageTitle>
      {/* ?surface= starts with one surface chosen, for "Open a surface again" on a saved session. */}
      <ScryingRoom initialSurface={isScryingSurface(surface) ? surface : "mirror"} hints={prefs.scaffolding === "more"} />
    </Page>
  );
}

export const metadata = { title: "Open a scrying surface" };
