import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { listCharmSets } from "@/lib/charms";
import CastForm from "@/components/charms/CastForm";
import { BackLink, Page, PageTitle } from "@/components/ui/Page";

export default async function CastPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  const [prefs, sets] = await Promise.all([getPrefs(session.userId), listCharmSets(session.userId)]);

  return (
    <Page>
      <BackLink href="/charms">← Charm casting</BackLink>
      <PageTitle>Cast charms</PageTitle>
      <CastForm hints={prefs.scaffolding === "more"} sets={sets} />
    </Page>
  );
}

export const metadata = { title: "Cast charms" };
