import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { getOghamSettings } from "@/lib/ogham";
import { listLayouts } from "@/lib/layouts";
import DrawForm from "@/components/ogham/DrawForm";
import { BackLink, Page, PageTitle } from "@/components/ui/Page";

export default async function DrawOghamPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const [settings, prefs, layouts] = await Promise.all([
    getOghamSettings(session.userId),
    getPrefs(session.userId),
    listLayouts(session.userId),
  ]);

  return (
    <Page>
      <BackLink href="/ogham">
        ← Ogham
      </BackLink>
      <PageTitle>Draw some staves</PageTitle>

      <DrawForm hints={prefs.scaffolding === "more"} forfeda={settings.forfeda} layouts={layouts} />
    </Page>
  );
}

export const metadata = { title: "Draw ogham staves" };
