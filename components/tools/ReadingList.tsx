import Link from "next/link";
import { parseDate, toISOString } from "@/lib/date";
import { Page, PageTitle, SectionLabel } from "@/components/ui/Page";
import { ButtonLink } from "@/components/ui/Button";

export interface ListItem {
  id: number;
  href: string;
  headline: string;
  question: string | null;
  created_at: string;
  entry_count: number;
}

interface Props {
  title: string;
  newHref: string;
  newLabel: string;
  /** Short paragraphs under the title. */
  intro: string[];
  /** The heading of the list, for example "Past draws". */
  listLabel: string;
  emptyText: string;
  items: ListItem[];
  /** Extra links under the list (a set page, for example). */
  extra?: React.ReactNode;
}

/** The list page of a newer tool: its title, a button to begin, a short introduction and the past readings, newest first. */
export default function ReadingList(p: Props) {
  const heading = `${p.title.replace(/\W+/g, "-").toLowerCase()}-list`;
  return (
    <Page>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <PageTitle>{p.title}</PageTitle>
        <ButtonLink href={p.newHref} variant="primary">
          {p.newLabel}
        </ButtonLink>
      </div>
      {p.intro.map((t) => (
        <p key={t} className="text-sm text-ink-muted leading-relaxed">{t}</p>
      ))}
      {p.extra}
      <section aria-labelledby={heading} className="space-y-3">
        <SectionLabel id={heading}>
          {p.listLabel}
          {p.items.length > 0 ? ` (${p.items.length})` : ""}
        </SectionLabel>
        {p.items.length === 0 ? (
          <p className="text-sm text-ink-ghost">{p.emptyText}</p>
        ) : (
          <ul className="space-y-3 list-none p-0">
            {p.items.map((r) => (
              <li key={r.id}>
                <Link href={r.href} className="block bg-surface border border-line rounded-card p-4 hover:border-line-hover transition-colors">
                  <div className="flex justify-between items-start gap-3">
                    <p className="font-medium text-ink-strong break-words min-w-0 line-clamp-2">{r.headline}</p>
                    <time className="text-xs text-ink-ghost whitespace-nowrap" dateTime={toISOString(r.created_at)}>
                      {parseDate(r.created_at).toLocaleDateString()}
                    </time>
                  </div>
                  {r.question && <p className="text-sm text-ink-faint mt-1 line-clamp-2 break-words">{r.question}</p>}
                  {r.entry_count > 0 && (
                    <p className="text-xs text-tone-500 mt-1">
                      {r.entry_count} entr{r.entry_count !== 1 ? "ies" : "y"}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Page>
  );
}
