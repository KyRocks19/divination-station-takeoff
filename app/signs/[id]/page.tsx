import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { readingSky } from "@/lib/sky";
import { listEntries, type DivinationEntry } from "@/lib/divinations";
import { toId } from "@/lib/oracle";
import { loadNote, type SignNote } from "@/lib/signs";
import NoteView from "@/components/signs/NoteView";
import { BackLink } from "@/components/ui/Page";

export default async function SignNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const [found, prefs] = await Promise.all([loadNote(session.userId, toId(id)), getPrefs(session.userId)]);
  if (!found) {
    return (
      <div className="max-w-page mx-auto px-4 py-8 space-y-3">
        <p className="text-ink-faint">Note not found.</p>
        <BackLink href="/signs">← Signs and dreams</BackLink>
      </div>
    );
  }

  // Dates become text here, so the view starts with the same shape the API returns.
  const initialReading: SignNote = JSON.parse(JSON.stringify(found));
  const initialEntries: DivinationEntry[] = JSON.parse(JSON.stringify(await listEntries(session.userId, found.id)));
  return <NoteView initialReading={initialReading} initialEntries={initialEntries} sky={readingSky(initialReading, prefs.hemisphere)} />;
}

export const metadata = { title: "A sign or dream" };
