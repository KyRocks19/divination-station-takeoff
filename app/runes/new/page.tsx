import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { getRuneSettings } from "@/lib/runes";
import { listLayouts } from "@/lib/layouts";
import DrawForm from "@/components/runes/DrawForm";
import { BackLink, Page, PageTitle } from "@/components/ui/Page";

export default async function DrawRunesPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const [settings, prefs, layouts] = await Promise.all([
    getRuneSettings(session.userId),
    getPrefs(session.userId),
    listLayouts(session.userId),
  ]);

  return (
    <Page>
      <BackLink href="/runes">
        ← Runes
      </BackLink>
      <PageTitle>Draw some runes</PageTitle>

      <DrawForm hints={prefs.scaffolding === "more"} reversals={settings.reversals} chance={settings.chance} layouts={layouts} />
    </Page>
  );
}

export const metadata = { title: "Draw runes" };
