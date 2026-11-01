import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getSourceNotes } from "@/lib/source-notes";
import { SOURCE_NOTE_MAX } from "@/lib/source-notes-core";
import SourceNote from "@/components/sources/SourceNote";
import { CHECK_OUT, PRIMARY_CHECKED_ON, PRIMARY_SOURCES, SECONDARY_SOURCES, type PrimarySource } from "@/lib/primary-sources";
import { BackLink, JumpLinks, Page, PageTitle, SectionLabel } from "@/components/ui/Page";
import { Card } from "@/components/ui/Card";

function PrimaryCard({ s, n, note, isAdmin }: { s: PrimarySource; n?: number; note: string | null; isAdmin: boolean }) {
  return (
    <Card id={s.id} className="space-y-3 scroll-mt-20">
      <div>
        <h3 className="text-base font-medium text-ink-strong">
          {n !== undefined && <span className="text-ink-faint">{n}.</span>} {s.name}: {s.work}
        </h3>
        <p className="text-sm text-ink-muted mt-1 break-words">{s.cite}</p>
        <p className="text-xs text-ink-faint mt-0.5">
          <a href={s.url} target="_blank" rel="noreferrer" className="underline hover:text-accent-ink">
            {s.urlLabel}
          </a>
        </p>
      </div>
      <p className="text-sm text-ink-muted leading-relaxed">{s.about}</p>
      {s.why && (
        <p className="text-sm text-ink-muted leading-relaxed">
          <span className="font-medium text-ink-strong">Why it is here: </span>
          {s.why}
        </p>
      )}
      {s.page && (
        <p className="text-sm">
          <Link href={s.page} className="text-accent-ink hover:text-accent-ink-hover underline">
            Read the full page on {s.name}
          </Link>
        </p>
      )}
      {s.groups?.map((g) => (
        <section key={g.id} aria-labelledby={`${g.id}-title`} className="space-y-1.5">
          <h4 id={`${g.id}-title`} className="text-sm font-medium text-ink-strong">
            {g.title}
          </h4>
          {g.intro && <p className="text-xs text-ink-muted leading-relaxed">{g.intro}</p>}
          <ul className="space-y-1.5 list-disc pl-5">
            {g.links.map((l) => (
              <li key={l.url} className="text-sm text-ink-muted leading-relaxed">
                <a href={l.url} target="_blank" rel="noreferrer" className="underline hover:text-accent-ink break-words">
                  {l.label}
                </a>
                {l.note && <span className="block text-xs text-ink-muted">{l.note}</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {s.caution && <p className="text-xs text-warning-ink leading-relaxed">Keep in mind: {s.caution}</p>}
      <p className="text-xs text-ink-faint leading-relaxed">{s.basis}</p>
      <SourceNote sourceId={s.id} sourceName={s.name} note={note} isAdmin={isAdmin} max={SOURCE_NOTE_MAX} />
    </Card>
  );
}

export default async function PrimarySourcesPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  const notes = await getSourceNotes();
  const isAdmin = !!session.isAdmin;

  return (
    <Page>
      <BackLink href="/sources">← Sources</BackLink>
      <PageTitle>Primary sources</PageTitle>

      <p className="text-sm text-ink-muted leading-relaxed">
        The works this app&apos;s maker draws on most. The first four are in the maker&apos;s order; the books from the
        maker&apos;s shelf follow, by subject: tarot, then magick and witchcraft, then the paranormal. They are not graded
        against the three tests the other sources are; each says what it is and how it was checked. More will be added.
      </p>

      <JumpLinks
        items={[
          ...PRIMARY_SOURCES.map((s) => ({ id: s.id, label: s.name })),
          { id: "secondary", label: "Secondary and tangential" },
          { id: "check-out", label: "Things to check out" },
        ]}
      />

      <p className="text-xs text-ink-faint">Details and links checked on {PRIMARY_CHECKED_ON}.</p>
      <section aria-labelledby="primary-title" className="space-y-3">
        <SectionLabel id="primary-title">Primary sources</SectionLabel>
        <ol className="space-y-4 list-none p-0">
          {PRIMARY_SOURCES.map((s, i) => (
            <li key={s.id}>
              <PrimaryCard s={s} n={i + 1} note={notes.get(s.id) ?? null} isAdmin={isAdmin} />
            </li>
          ))}
        </ol>
      </section>

      <section id="secondary" aria-labelledby="secondary-title" className="space-y-3 scroll-mt-20">
        <SectionLabel id="secondary-title">Secondary and tangential sources</SectionLabel>
        <p className="text-sm text-ink-muted leading-relaxed">
          Works that sit beside the primary sources: they came to the maker along the way, or touch the same questions
          from another side.
        </p>
        <ul className="space-y-4 list-none p-0">
          {SECONDARY_SOURCES.map((s) => (
            <li key={s.id}>
              <PrimaryCard s={s} note={notes.get(s.id) ?? null} isAdmin={isAdmin} />
            </li>
          ))}
        </ul>
      </section>

      <section id="check-out" aria-labelledby="check-out-title" className="space-y-3 scroll-mt-20">
        <SectionLabel id="check-out-title">Things to check out</SectionLabel>
        <p className="text-sm text-ink-muted leading-relaxed">Not sources for the app, but things its maker recommends.</p>
        <Card>
          <ul className="space-y-2 list-disc pl-5">
            {CHECK_OUT.map((l) => (
              <li key={l.url} className="text-sm text-ink-muted leading-relaxed">
                <a href={l.url} target="_blank" rel="noreferrer" className="underline hover:text-accent-ink break-words">
                  {l.label}
                </a>
                {l.note && <span className="block text-xs text-ink-muted">{l.note}</span>}
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </Page>
  );
}

export const metadata = { title: "Primary sources" };
