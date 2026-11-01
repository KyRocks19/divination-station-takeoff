import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { readingSky } from "@/lib/sky";
import { listEntries, type DivinationEntry } from "@/lib/divinations";
import { DIVINATION_KIND_LABELS } from "@/lib/divination-kinds";
import { toId } from "@/lib/oracle";
import { loadCast, type BlotCast } from "@/lib/blots";
import BlotView from "@/components/blots/BlotView";
import { BackLink } from "@/components/ui/Page";

export default async function BlotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const [found, prefs] = await Promise.all([loadCast(session.userId, "blots", toId(id)), getPrefs(session.userId)]);
  if (!found) {
    // A cup of tea leaves saved before the two tools were split (2026-10-29) may be linked here from older pages: open it in tasseomancy.
    if (await loadCast(session.userId, "tea", toId(id))) redirect(`/tea/${toId(id)}`);
    return (
      <div className="max-w-page mx-auto px-4 py-8 space-y-3">
        <p className="text-ink-faint">Blot not found.</p>
        <BackLink href="/blots">← {DIVINATION_KIND_LABELS.blots}</BackLink>
      </div>
    );
  }

  // Dates become text here, so the view starts with the same shape the API returns.
  const initialReading: BlotCast = JSON.parse(JSON.stringify(found));
  const initialEntries: DivinationEntry[] = JSON.parse(JSON.stringify(await listEntries(session.userId, found.id)));
  return <BlotView initialReading={initialReading} initialEntries={initialEntries} sky={readingSky(initialReading, prefs.hemisphere)} />;
}

export const metadata = { title: "An ink blot" };
