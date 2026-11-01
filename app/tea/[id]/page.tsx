import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { readingSky } from "@/lib/sky";
import { listEntries, type DivinationEntry } from "@/lib/divinations";
import { DIVINATION_KIND_LABELS } from "@/lib/divination-kinds";
import { toId } from "@/lib/oracle";
import { loadCast, type BlotCast } from "@/lib/blots";
import TeaView from "@/components/tea/TeaView";
import { BackLink } from "@/components/ui/Page";

export default async function TeaCupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const [found, prefs] = await Promise.all([loadCast(session.userId, "tea", toId(id)), getPrefs(session.userId)]);
  if (!found) {
    return (
      <div className="max-w-page mx-auto px-4 py-8 space-y-3">
        <p className="text-ink-faint">Cup not found.</p>
        <BackLink href="/tea">← {DIVINATION_KIND_LABELS.tea}</BackLink>
      </div>
    );
  }

  // Dates become text here, so the view starts with the same shape the API returns.
  const initialReading: BlotCast = JSON.parse(JSON.stringify(found));
  const initialEntries: DivinationEntry[] = JSON.parse(JSON.stringify(await listEntries(session.userId, found.id)));
  return <TeaView initialReading={initialReading} initialEntries={initialEntries} sky={readingSky(initialReading, prefs.hemisphere)} />;
}

export const metadata = { title: "A cup of tea leaves" };
