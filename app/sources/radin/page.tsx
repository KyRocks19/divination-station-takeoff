import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import {
  RADIN_CHECKED_ON,
  RADIN_INTRO,
  RADIN_SECTIONS,
  RADIN_SOURCES,
  getRadinSource,
  type RadinParagraph,
} from "@/lib/radin-research";
import { BackLink, JumpLinks, Page, PageTitle, SectionLabel } from "@/components/ui/Page";
import { Card } from "@/components/ui/Card";

/** The numbers shown after a paragraph follow the order of the sources list, so "[3]" is the third card at the bottom. */
const SOURCE_NUMBER = new Map(RADIN_SOURCES.map((s, i) => [s.id, i + 1]));

function Paragraph({ p }: { p: RadinParagraph }) {
  return (
    <p className="text-sm text-ink-muted leading-relaxed">
      {p.text}
      {p.cites.length > 0 && (
        <span className="text-xs text-ink-faint">
          {" "}
          {[...p.cites].sort((a, b) => (SOURCE_NUMBER.get(a) ?? 0) - (SOURCE_NUMBER.get(b) ?? 0)).map((id) => {
            const s = getRadinSource(id);
            const n = SOURCE_NUMBER.get(id);
            if (!s || !n) return null;
            return (
              <a key={id} href={`#source-${id}`} aria-label={`[${n}] ${s.cite}`} className="inline-flex min-h-6 min-w-6 items-center justify-center align-middle underline hover:text-accent-ink">
                [{n}]
              </a>
            );
          })}
        </span>
      )}
    </p>
  );
}

export default async function RadinPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  return (
    <Page>
      <BackLink href="/sources">← Sources</BackLink>
      <PageTitle>Dean Radin&apos;s research</PageTitle>

      <div className="space-y-3">
        {RADIN_INTRO.map((p, i) => (
          <Paragraph key={i} p={p} />
        ))}
      </div>

      <JumpLinks items={[...RADIN_SECTIONS.map((s) => ({ id: s.id, label: s.title })), { id: "radin-sources", label: "Sources" }]} />

      {RADIN_SECTIONS.map((section) => (
        <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="space-y-3 scroll-mt-20">
          <SectionLabel id={`${section.id}-title`}>{section.title}</SectionLabel>
          {section.paragraphs.map((p, i) => (
            <Paragraph key={i} p={p} />
          ))}
        </section>
      ))}

      <section id="radin-sources" aria-labelledby="radin-sources-title" className="space-y-3 scroll-mt-20">
        <SectionLabel id="radin-sources-title">Sources</SectionLabel>
        <p className="text-xs text-ink-faint leading-relaxed">
          Checked on {RADIN_CHECKED_ON} from the pages linked below: open-access papers, abstracts, summaries and published
          reviews. Radin&apos;s books were not read for this page. Each card says how its source was checked.
        </p>
        <ol className="space-y-3 list-none p-0">
          {RADIN_SOURCES.map((s, i) => (
            <li key={s.id}>
              <Card id={`source-${s.id}`} pad="sm" className="space-y-1.5 scroll-mt-20">
                <p className="text-sm text-ink-strong break-words">
                  <span className="text-ink-faint">{i + 1}.</span> {s.cite}
                </p>
                <p className="text-xs text-ink-faint">
                  {s.kind} ·{" "}
                  <a href={s.url} target="_blank" rel="noreferrer" className="underline hover:text-accent-ink break-all">
                    {s.urlLabel}
                  </a>
                </p>
                <p className="text-xs text-ink-muted leading-relaxed">{s.note}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>
    </Page>
  );
}

export const metadata = { title: "Dean Radin's research" };
