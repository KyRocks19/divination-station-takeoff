import { aiReadyFor } from "@/lib/ai-ready";
import Link from "next/link";
import AddToDay from "@/components/AddToDay";
import { query } from "@/lib/db";
import { getSession } from "@/lib/session";
import { parseDate } from "@/lib/date";
import SynthesisJournalCard from "./SynthesisJournalCard";
import TagManager from "@/components/TagManager";
import ToolFilterLine from "@/components/ToolFilterLine";
import { DEFAULT_PREFS, getPrefs } from "@/lib/prefs";
import { DIVINATION_KIND_LABELS, countEntriesNotIn, divinationPath, isWidened, toolFilterHref, toolNames } from "@/lib/divinations";
import { PageTitle, SectionLabel } from "@/components/ui/Page";
import { SigilMark } from "@/components/ui/AppSigil";

export default async function JournalsPage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>;
}) {
  const sp = await searchParams;
  const session = await getSession();

  // The page starts with the tools the person chose. "Show everything" widens this one page; the saved choice stays.
  const prefs = session.userId ? await getPrefs(session.userId) : DEFAULT_PREFS;
  const ai = await aiReadyFor(session.userId);
  const widened = isWidened(sp);
  const shown = widened ? null : prefs.tools;

  const [journals, synthesisJournals, hiddenCount] = await Promise.all([
    // Entries about tarot readings (reading_id) and about readings of any other kind (divination_id), together.
    // An entry with no shared record is about a tarot reading.
    query(`
      SELECT j.*,
        r.title, r.spread_name, r.question,
        d.kind AS divination_kind, d.summary AS divination_summary, d.question AS divination_question,
        COALESCE(
          (SELECT JSON_AGG(JSON_BUILD_OBJECT('id', t.id, 'name', t.name, 'color', t.color) ORDER BY t.name)
           FROM journal_tags jt JOIN tags t ON t.id = jt.tag_id
           WHERE jt.journal_id = j.id),
          '[]'::json
        ) AS tags
      FROM journals j
      LEFT JOIN readings r ON r.id = j.reading_id
      LEFT JOIN divinations d ON d.id = j.divination_id
      WHERE COALESCE(r.user_id, d.user_id) = $1
        AND ($2::text[] IS NULL OR COALESCE(d.kind, 'tarot') = ANY($2::text[]))
      ORDER BY j.created_at DESC
    `, [session.userId, shown]) as Promise<any[]>,
    // A synthesis is made from tarot readings and what was written about them, so it is listed with tarot.
    shown === null || shown.includes("tarot")
      ? (query(
          "SELECT * FROM synthesis_journals WHERE user_id = $1 ORDER BY created_at DESC",
          [session.userId]
        ) as Promise<any[]>)
      : Promise.resolve([] as any[]),
    // How many entries the saved choice of tools is leaving out of this list.
    session.userId && !widened ? countEntriesNotIn(session.userId, prefs.tools) : Promise.resolve(0),
  ]);

  const claudeEntries = journals.filter((j) => j.author !== "user");
  const userEntries = journals.filter((j) => j.author === "user");
  const isEmpty = journals.length === 0 && synthesisJournals.length === 0;

  return (
    <div className="max-w-page mx-auto px-4 py-8 space-y-8">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <PageTitle>Journals</PageTitle>
          {/* A new entry here is written with Claude, so the link is left out without a Claude key that works (and always in Feathered). */}
          {ai.claude && (
            <Link
              href="/journals/new"
              className="text-xs bg-tone-800/60 hover:bg-tone-700/60 text-tone-200 font-medium px-4 py-2 min-h-11 sm:min-h-0 rounded-lg transition-colors"
            >
              <SigilMark /> New Entry
            </Link>
          )}
        </div>
        <ToolFilterLine tools={prefs.tools} widened={widened} path="/journals" hidden={hiddenCount} />
      </div>

      {isEmpty ? (
        <div className="text-center py-20 text-ink-faint">
          <div className="text-5xl mb-4">📖</div>
          {shown ? (
            <>
              <p>Nothing here for {toolNames(shown)} yet.</p>
              <Link
                href={toolFilterHref("/journals", true)}
                className="text-tone-400 hover:text-tone-300 text-sm mt-2 inline-block"
              >
                Show everything
              </Link>
            </>
          ) : (
            <p>No journal entries yet.</p>
          )}
        </div>
      ) : (
        <>
          {synthesisJournals.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs text-ink-faint uppercase tracking-widest flex items-center gap-2">
                <SigilMark className="text-tone-400" /> Synthesis ({synthesisJournals.length})
              </h2>
              {synthesisJournals.map((s: any) => (
                <SynthesisJournalCard key={s.id} entry={s} />
              ))}
            </section>
          )}

          {claudeEntries.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs text-ink-faint uppercase tracking-widest flex items-center gap-2">
                <SigilMark className="text-tone-400" /> Claude&apos;s Journals ({claudeEntries.length})
              </h2>
              {claudeEntries.map((j) => (
                <JournalCard key={j.id} journal={j} />
              ))}
            </section>
          )}

          {userEntries.length > 0 && (
            <section className="space-y-3">
              <SectionLabel>Your Notes ({userEntries.length})</SectionLabel>
              {userEntries.map((j) => (
                <JournalCard key={j.id} journal={j} />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}

/** An entry about a pull (or any reading that is not tarot). It opens that reading, where it can be changed or deleted; tags are added here. */
function DivinationEntryCard({ journal }: { journal: any }) {
  const kind = journal.divination_kind as keyof typeof DIVINATION_KIND_LABELS;
  const label = DIVINATION_KIND_LABELS[kind] ?? "Reading";
  const href = divinationPath(kind, journal.divination_id);
  return (
    <div className="bg-surface border border-line rounded-card hover:border-line-hover transition-colors">
      <Link href={href} className="block p-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-tone-500">
              {label}
              {journal.divination_summary && <span> · {journal.divination_summary}</span>}
              {journal.divination_question && (
                <span className="font-normal text-ink-faint"> — {journal.divination_question}</span>
              )}
            </p>
            {journal.kind === "lookback" && (
              <p className="text-[10px] text-success uppercase tracking-widest mt-1">Looking back</p>
            )}
            {journal.kind === "impression" && (
              <p className="text-[10px] text-tone-300 uppercase tracking-widest mt-1">What you noticed first</p>
            )}
            <p className="text-sm text-ink-soft mt-1 line-clamp-3 whitespace-pre-wrap">{journal.content}</p>
          </div>
          <span className="text-xs text-ink-ghost whitespace-nowrap">
            {parseDate(journal.created_at).toLocaleDateString()}
          </span>
        </div>
      </Link>
      <div className="px-4 pb-3">
        <TagManager
          entityType="journal"
          entityId={journal.id}
          initialTags={Array.isArray(journal.tags) ? journal.tags : []}
        />
        <div className="mt-1"><AddToDay kind="journal_entry" refId={journal.id} /></div>
      </div>
    </div>
  );
}

function JournalCard({ journal }: { journal: any }) {
  if (!journal.reading_id && journal.divination_id) return <DivinationEntryCard journal={journal} />;
  const tags = Array.isArray(journal.tags) ? journal.tags : [];
  return (
    <div
      className={`bg-surface border rounded-xl hover:border-line-hover transition-colors ${
        journal.author === "claude" ? "border-line" : "border-line"
      }`}
    >
      <Link href={`/readings/${journal.reading_id}`} className="block p-4 pb-2 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-tone-500">
              {DIVINATION_KIND_LABELS.tarot} · {journal.title || journal.spread_name}
              {journal.question && <span className="font-normal text-ink-faint"> — {journal.question}</span>}
            </p>
            <p className="text-sm text-ink-soft mt-1 line-clamp-3 whitespace-pre-wrap">{journal.content}</p>
          </div>
          <span className="text-xs text-ink-ghost whitespace-nowrap">
            {parseDate(journal.created_at).toLocaleDateString()}
          </span>
        </div>
      </Link>
      <div className="px-4 pb-3">
        <TagManager entityType="journal" entityId={journal.id} initialTags={tags} />
        <div className="mt-1"><AddToDay kind="journal_entry" refId={journal.id} /></div>
      </div>
    </div>
  );
}

export const metadata = { title: "Journals" };
