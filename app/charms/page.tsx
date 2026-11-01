import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { listCasts, CHARM_WORDS } from "@/lib/charms";
import ReadingList from "@/components/tools/ReadingList";

export default async function CharmsPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  const casts = await listCasts(session.userId);

  return (
    <ReadingList
      title="Charm casting"
      newHref="/charms/new"
      newLabel="Cast charms"
      intro={[CHARM_WORDS.here, "This is this app's own design, not a particular tradition: no old source is claimed for it."]}
      listLabel="Past casts"
      emptyText="No casts are saved."
      items={casts.map((c) => ({
        id: c.id,
        href: `/charms/${c.id}`,
        headline: `${c.set_name || "A set"}: ${c.charms.length} charm${c.charms.length === 1 ? "" : "s"}`,
        question: c.question,
        created_at: c.created_at,
        entry_count: c.entry_count,
      }))}
    />
  );
}

export const metadata = { title: "Charm casting" };
