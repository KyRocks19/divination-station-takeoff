import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { toId } from "@/lib/oracle";
import { loadTossable } from "@/lib/cloths";
import { parseDate } from "@/lib/date";
import { DIVINATION_KIND_LABELS, divinationPath } from "@/lib/divination-kinds";
import CastRecord from "@/components/cloth/CastRecord";
import { BackLink, Page, PageTitle } from "@/components/ui/Page";

// Tossing one reading's items onto a cloth. Only the person's own reading, and only one made with a tool that has items.
export default async function TossReadingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const reading = await loadTossable(session.userId, toId(id));
  if (!reading) {
    return (
      <div className="max-w-page mx-auto px-4 py-8 space-y-3">
        <p className="text-ink-faint">Reading not found.</p>
        <BackLink href="/lots">← Tossing lots</BackLink>
      </div>
    );
  }

  const label = DIVINATION_KIND_LABELS[reading.kind];
  return (
    <Page>
      <BackLink href="/lots">← Tossing lots</BackLink>
      <PageTitle className="break-words">{reading.summary || label}</PageTitle>
      <p className="text-sm text-ink-muted break-words">
        {label} · {parseDate(reading.created_at).toLocaleDateString()}
        {reading.question ? ` · ${reading.question}` : ""}
      </p>
      <p className="text-sm">
        <Link href={divinationPath(reading.kind, reading.id, reading.reading_id)} className="underline text-accent-ink hover:text-accent-ink-hover">
          Open the reading
        </Link>
      </p>
      <CastRecord divinationId={reading.id} />
    </Page>
  );
}

export const metadata = { title: "Toss a reading" };
