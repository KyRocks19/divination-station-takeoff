import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getSourceNotes } from "@/lib/source-notes";
import { SOURCE_NOTE_MAX } from "@/lib/source-notes-core";
import SourceNote from "@/components/sources/SourceNote";
import { DIVINATION_KIND_LABELS, DIVINATION_KIND_PAGES, DIVINATION_KINDS, type DivinationKind } from "@/lib/divination-kinds";
import ToolGlyph from "@/components/ui/ToolGlyph";
import {
  DEFAULT_BASIS,
  TOOL_GUIDES,
  getSource,
  type Level,
  type Source,
  type ToolGuideId,
} from "@/lib/sources";
import { BackLink, Page, PageTitle, SectionLabel } from "@/components/ui/Page";
import { Card } from "@/components/ui/Card";

const LEVEL_WORDS: Record<Level, string> = { yes: "Yes", partly: "Partly", no: "No", unclear: "Not settled" };
const LEVEL_STYLE: Record<Level, string> = {
  yes: "text-success-ink",
  partly: "text-warning-ink",
  no: "text-ink-muted",
  unclear: "text-ink-faint",
};

const TESTS: { key: "lists" | "record" | "magick"; question: string }[] = [
  { key: "lists", question: "Lists its own sources" },
  { key: "record", question: "Separates the record from hearsay" },
  { key: "magick", question: "Treats magick as serious" },
];

function toolTitle(tool: ToolGuideId): string {
  return tool === "across" ? "Across every tool" : DIVINATION_KIND_LABELS[tool];
}

/** The admins' notes and whether the person reading may write them (migration 097). */
interface NoteCtx {
  notes: Map<string, string>;
  isAdmin: boolean;
}

function SourceCard({ s, ctx }: { s: Source; ctx: NoteCtx }) {
  return (
    <Card id={s.id} className="space-y-3 scroll-mt-20">
      <div>
        <p className="text-sm font-medium text-ink-strong break-words">{s.cite}</p>
        <p className="text-xs text-ink-faint mt-0.5">
          {s.kind} ·{" "}
          <a href={s.url} target="_blank" rel="noreferrer" className="underline hover:text-accent-ink">
            {s.urlLabel}
          </a>
        </p>
      </div>
      <p className="text-sm text-ink-muted leading-relaxed">{s.about}</p>
      <dl className="space-y-1.5">
        {TESTS.map(({ key, question }) => (
          <div key={key} className="text-xs leading-relaxed">
            <dt className="inline text-ink-faint">{question}: </dt>
            <dd className="inline">
              <span className={`font-semibold ${LEVEL_STYLE[s[key].level]}`}>{LEVEL_WORDS[s[key].level]}.</span>{" "}
              <span className="text-ink-muted">{s[key].note}</span>
            </dd>
          </div>
        ))}
      </dl>
      {s.caution && (
        <p className="text-xs text-warning-ink leading-relaxed">
          <span className="font-semibold">Keep in mind:</span> {s.caution}
        </p>
      )}
      {s.basis && <p className="text-[11px] text-ink-ghost leading-relaxed">{s.basis}</p>}
      <SourceNote sourceId={s.id} sourceName={s.short} note={ctx.notes.get(s.id) ?? null} isAdmin={ctx.isAdmin} max={SOURCE_NOTE_MAX} />
    </Card>
  );
}

function SourceGroup({ id, title, note, ids, ctx }: { id: string; title: string; note?: string; ids: string[]; ctx: NoteCtx }) {
  const sources = ids.map(getSource).filter((s): s is Source => !!s);
  if (sources.length === 0) return null;
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div>
        <SectionLabel id={id}>{title}</SectionLabel>
        {note && <p className="text-xs text-ink-faint mt-1">{note}</p>}
      </div>
      <div className="space-y-4">
        {sources.map((s) => (
          <SourceCard key={s.id} s={s} ctx={ctx} />
        ))}
      </div>
    </section>
  );
}

export default async function ToolSourcesPage({ params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params;
  const session = await getSession();
  if (!session.userId) redirect("/login");
  if (!(tool in TOOL_GUIDES)) notFound();

  const id = tool as ToolGuideId;
  const guide = TOOL_GUIDES[id];
  const isKind = (DIVINATION_KINDS as string[]).includes(id);
  const ctx: NoteCtx = { notes: await getSourceNotes(), isAdmin: !!session.isAdmin };

  return (
    <Page>
      <BackLink href="/sources">← All sources</BackLink>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <PageTitle>
          {isKind && <><ToolGlyph kind={id as DivinationKind} className="inline-block h-[1.1em] w-[1.1em] align-text-bottom" />{" "}</>}
          {toolTitle(id)}: sources
        </PageTitle>
        {isKind && (
          <Link href={DIVINATION_KIND_PAGES[id as keyof typeof DIVINATION_KIND_PAGES]} className="text-sm text-accent-ink hover:text-accent-ink-hover">
            Open {toolTitle(id)}
          </Link>
        )}
      </div>

      {(guide.survives.length > 0 || guide.conjecture.length > 0) && (
        <section aria-labelledby="record-vs-hearsay" className="grid gap-4 md:grid-cols-2">
          <Card className="space-y-2">
            <SectionLabel id="record-vs-hearsay">What still exists</SectionLabel>
            <ul className="list-disc pl-5 space-y-1.5">
              {guide.survives.map((line) => (
                <li key={line} className="text-sm text-ink-muted leading-relaxed">{line}</li>
              ))}
            </ul>
          </Card>
          <Card className="space-y-2">
            <SectionLabel>What is conjecture or later invention</SectionLabel>
            <ul className="list-disc pl-5 space-y-1.5">
              {guide.conjecture.map((line) => (
                <li key={line} className="text-sm text-ink-muted leading-relaxed">{line}</li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      {guide.gap && <p className="text-sm text-ink-muted leading-relaxed">{guide.gap}</p>}

      <SourceGroup
        ctx={ctx}
        id="start-here"
        title="Start here"
        note="Chosen against the three tests. Each says which it meets, and where it falls short."
        ids={guide.start}
      />
      <SourceGroup
        ctx={ctx}
        id="the-record"
        title="The record itself"
        note="Texts, objects, and databases: what survives, so you can look for yourself."
        ids={guide.record.filter((r) => !guide.start.includes(r))}
      />
      <SourceGroup ctx={ctx} id="also" title="Also worth reading" ids={guide.more.filter((r) => !guide.start.includes(r))} />

      <p className="text-xs text-ink-ghost leading-relaxed">
        {DEFAULT_BASIS} A marker in the app&rsquo;s text that says &ldquo;Read more&rdquo; means the source
        treats that topic, not that a given page proves a given sentence; the app&rsquo;s text has not yet been matched to page
        numbers. If you find a better source, or an error here, say so through Feedback.
      </p>
    </Page>
  );
}

export const metadata = { title: "Sources for a tool" };
