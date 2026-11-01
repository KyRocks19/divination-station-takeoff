import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { readingSky } from "@/lib/sky";
import { listEntries, type DivinationEntry } from "@/lib/divinations";
import { toId } from "@/lib/oracle";
import { loadCast, type IChingCast } from "@/lib/iching";
import CastView from "@/components/iching/CastView";
import { BackLink } from "@/components/ui/Page";

export default async function IChingCastPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const [found, prefs] = await Promise.all([loadCast(session.userId, toId(id)), getPrefs(session.userId)]);
  if (!found) {
    return (
      <div className="max-w-page mx-auto px-4 py-8 space-y-3">
        <p className="text-ink-faint">Cast not found.</p>
        <BackLink href="/iching">← I Ching</BackLink>
      </div>
    );
  }

  // Dates become text here, so the view starts with the same shape the API returns.
  const initialCast: IChingCast = JSON.parse(JSON.stringify(found));
  const initialEntries: DivinationEntry[] = JSON.parse(JSON.stringify(await listEntries(session.userId, found.id)));
  return <CastView initialCast={initialCast} initialEntries={initialEntries} sky={readingSky(initialCast, prefs.hemisphere)} />;
}

export const metadata = { title: "An I Ching cast" };
