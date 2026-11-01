import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { listNotes, noteSummary, SIGN_WORDS } from "@/lib/signs";
import ReadingList from "@/components/tools/ReadingList";

export default async function SignsPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  const notes = await listNotes(session.userId);

  return (
    <ReadingList
      title="Signs and dreams"
      newHref="/signs/new"
      newLabel="Note a sign or dream"
      intro={[SIGN_WORDS.here, "This is a log, not a method, so it has no sources page: the app says nothing about what a sign or dream means."]}
      listLabel="Your notes"
      emptyText="No notes are saved."
      items={notes.map((n) => ({
        id: n.id,
        href: `/signs/${n.id}`,
        headline: noteSummary(n.note_type, n.body),
        question: null,
        created_at: n.created_at,
        entry_count: n.entry_count,
      }))}
    />
  );
}

export const metadata = { title: "Signs and dreams" };
