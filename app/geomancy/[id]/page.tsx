import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { readingSky } from "@/lib/sky";
import { listEntries, type DivinationEntry } from "@/lib/divinations";
import { toId } from "@/lib/oracle";
import { loadChart, type GeomancyChart } from "@/lib/geomancy";
import ChartView from "@/components/geomancy/ChartView";
import { BackLink } from "@/components/ui/Page";

export default async function GeomancyChartPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const [found, prefs] = await Promise.all([loadChart(session.userId, toId(id)), getPrefs(session.userId)]);
  if (!found) {
    return (
      <div className="max-w-page mx-auto px-4 py-8 space-y-3">
        <p className="text-ink-faint">Chart not found.</p>
        <BackLink href="/geomancy">← Geomancy</BackLink>
      </div>
    );
  }

  // Dates become text here, so the view starts with the same shape the API returns.
  const initialChart: GeomancyChart = JSON.parse(JSON.stringify(found));
  const initialEntries: DivinationEntry[] = JSON.parse(JSON.stringify(await listEntries(session.userId, found.id)));
  return <ChartView initialChart={initialChart} initialEntries={initialEntries} sky={readingSky(initialChart, prefs.hemisphere)} />;
}

export const metadata = { title: "A geomancy chart" };
