import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { listCasts, blotSummary, TEA_READING_WORDS } from "@/lib/blots";
import { DIVINATION_KIND_LABELS } from "@/lib/divination-kinds";
import ReadingList from "@/components/tools/ReadingList";

export default async function TeaPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  const casts = await listCasts(session.userId, "tea");

  return (
    <ReadingList
      title={DIVINATION_KIND_LABELS.tea}
      newHref="/tea/new"
      newLabel="Brew a cup"
      intro={[TEA_READING_WORDS.here, TEA_READING_WORDS.noSources]}
      listLabel="Past cups"
      emptyText="No cups are saved."
      items={casts.map((c) => ({
        id: c.id,
        href: `/tea/${c.id}`,
        headline: blotSummary("cup", c.tea),
        question: c.question,
        created_at: c.created_at,
        entry_count: c.entry_count,
      }))}
    />
  );
}

export const metadata = { title: "Tasseomancy" };
