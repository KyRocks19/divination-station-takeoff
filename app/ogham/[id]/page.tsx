import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { readingSky } from "@/lib/sky";
import { listEntries, type DivinationEntry } from "@/lib/divinations";
import { toId } from "@/lib/oracle";
import { getOghamSettings, loadDraw, type OghamDraw } from "@/lib/ogham";
import { ownNames } from "@/lib/own-names";
import { STAVES } from "@/lib/ogham-data";
import DrawView from "@/components/ogham/DrawView";
import { BackLink } from "@/components/ui/Page";

export default async function OghamDrawPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const [found, prefs, names, settings] = await Promise.all([
    loadDraw(session.userId, toId(id)),
    getPrefs(session.userId),
    ownNames(session.userId, STAVES.map((s) => s.id)),
    getOghamSettings(session.userId),
  ]);
  if (!found) {
    return (
      <div className="max-w-page mx-auto px-4 py-8 space-y-3">
        <p className="text-ink-faint">Draw not found.</p>
        <BackLink href="/ogham">
          ← Ogham
        </BackLink>
      </div>
    );
  }

  // Dates become text here, so the view starts with the same shape the API returns.
  const initialDraw: OghamDraw = JSON.parse(JSON.stringify(found));
  const initialEntries: DivinationEntry[] = JSON.parse(JSON.stringify(await listEntries(session.userId, found.id)));
  return (
    <DrawView
      initialDraw={initialDraw}
      initialEntries={initialEntries}
      sky={readingSky(initialDraw, prefs.hemisphere)}
      initialNames={names}
      initialLaterNames={settings.laterNames}
    />
  );
}

export const metadata = { title: "An ogham draw" };
