import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import ChartForm from "@/components/geomancy/ChartForm";
import { BackLink, Page, PageTitle } from "@/components/ui/Page";

export default async function CastChartPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const prefs = await getPrefs(session.userId);

  return (
    <Page>
      <BackLink href="/geomancy">← Geomancy</BackLink>
      <PageTitle>Cast a geomancy chart</PageTitle>

      <ChartForm hints={prefs.scaffolding === "more"} />
    </Page>
  );
}

export const metadata = { title: "Cast a geomancy chart" };
