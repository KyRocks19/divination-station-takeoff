import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { listCasts, blotSummary, BLOT_WORDS } from "@/lib/blots";
import { DIVINATION_KIND_LABELS } from "@/lib/divination-kinds";
import ReadingList from "@/components/tools/ReadingList";

export default async function BlotsPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  const casts = await listCasts(session.userId, "blots");

  return (
    <ReadingList
      title={DIVINATION_KIND_LABELS.blots}
      newHref="/blots/new"
      newLabel="Press a blot"
      intro={[BLOT_WORDS.here, BLOT_WORDS.noSources]}
      listLabel="Past blots"
      emptyText="No blots are saved."
      items={casts.map((c) => ({
        id: c.id,
        href: `/blots/${c.id}`,
        headline: blotSummary("ink"),
        question: c.question,
        created_at: c.created_at,
        entry_count: c.entry_count,
      }))}
    />
  );
}

export const metadata = { title: "Inkblots" };
