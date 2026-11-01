import Link from "next/link";
import { redirect } from "next/navigation";
import { PRIMARY_SOURCES, primaryHref } from "@/lib/primary-sources";
import { getSession } from "@/lib/session";
import { DIVINATION_KIND_LABELS, DIVINATION_KINDS } from "@/lib/divination-kinds";
import ToolGlyph from "@/components/ui/ToolGlyph";
import { KINDS_WITHOUT_GUIDE, SOURCES_CHECKED_ON, TOOL_GUIDES, getSource, type ToolGuideId } from "@/lib/sources";
import { BackLink, Page, PageTitle, SectionLabel } from "@/components/ui/Page";
import { Card, CardLink } from "@/components/ui/Card";

export default async function SourcesPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  return (
    <Page>
      <BackLink href="/">← Home</BackLink>
      <PageTitle>Sources</PageTitle>

      <p className="text-sm text-ink-muted leading-relaxed">
        Every tool here has a past, and part of the beauty of the world is learning it. For each tool this section names
        two or three people who have written about it carefully, so you can go to them yourself. It is also honest about
        what survives and what is only said.
      </p>

      <section aria-labelledby="primary" className="space-y-3">
        <SectionLabel id="primary">Primary sources</SectionLabel>
        <p className="text-sm text-ink-muted leading-relaxed">
          The works this app&apos;s maker draws on most.{" "}
          <Link href="/sources/primary" className="text-accent-ink hover:text-accent-ink-hover underline">
            All primary sources, with every link
          </Link> ·{" "}
          <Link href="/sources/primary#secondary" className="text-accent-ink hover:text-accent-ink-hover underline">
            Secondary sources and things to check out
          </Link>
        </p>
        <ol className="grid gap-3 sm:grid-cols-2 list-none p-0">
          {PRIMARY_SOURCES.map((s, i) => (
            <li key={s.id}>
              <CardLink href={primaryHref(s)} lift className="h-full">
                <p className="font-medium text-ink-strong">
                  <span className="text-ink-faint">{i + 1}.</span> {s.name}
                </p>
                <p className="text-xs text-ink-faint mt-1">{s.work}</p>
              </CardLink>
            </li>
          ))}
        </ol>
      </section>

      <Card className="space-y-2">
        <SectionLabel>Three tests</SectionLabel>
        <p className="text-sm text-ink-muted leading-relaxed">A source is recommended when it does these three things:</p>
        <ol className="list-decimal pl-5 space-y-1 text-sm text-ink-muted">
          <li>It lists its own sources, so you can check it.</li>
          <li>It explains what is left in the historical record (objects, texts, inscriptions) and what is hearsay or guesswork.</li>
          <li>It treats magick and divination as a serious subject: something people did, and do.</li>
        </ol>
        <p className="text-xs text-ink-faint leading-relaxed">
          Few books do all three. Where one falls short, its card says which and why, so you can use it knowingly. The
          books were checked by looking up their editions and published reviews on {SOURCES_CHECKED_ON}; the app&apos;s
          maker has not read them. A tradition that is alive (the Tibetan Mo, for example) is not reproduced here; its own
          teachers and texts are the place to learn it.
        </p>
      </Card>

      <section aria-labelledby="by-tool" className="space-y-3">
        <SectionLabel id="by-tool">By tool</SectionLabel>
        <ul className="grid gap-3 sm:grid-cols-2 list-none p-0">
          {DIVINATION_KINDS.filter((k): k is Exclude<ToolGuideId, "across"> => !(KINDS_WITHOUT_GUIDE as readonly string[]).includes(k)).map((kind) => {
            const names = TOOL_GUIDES[kind].start.map((id) => getSource(id)?.short).filter(Boolean);
            return (
              <li key={kind}>
                <CardLink href={`/sources/${kind}`} lift className="h-full">
                  <p className="font-medium text-ink-strong">
                    <ToolGlyph kind={kind} className="inline-block h-[1.1em] w-[1.1em] align-text-bottom" /> {DIVINATION_KIND_LABELS[kind]}
                  </p>
                  <p className="text-xs text-ink-faint mt-1">{names.join(", ")}</p>
                </CardLink>
              </li>
            );
          })}
          <li>
            <CardLink href="/sources/across" lift className="h-full">
              <p className="font-medium text-ink-strong">
                <span aria-hidden="true">🌐</span> Across every tool
              </p>
              <p className="text-xs text-ink-faint mt-1">
                Histories of modern witchcraft and magic books, a journal of Pagan studies, and a museum
              </p>
            </CardLink>
          </li>
        </ul>
      </section>
    </Page>
  );
}

export const metadata = { title: "Sources" };
