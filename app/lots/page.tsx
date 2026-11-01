import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { listCloths, listTossable } from "@/lib/cloths";
import { CLOTH_KINDS } from "@/lib/cloth-core";
import { parseDate } from "@/lib/date";
import { DIVINATION_KIND_LABELS, DIVINATION_KIND_START } from "@/lib/divination-kinds";
import { Page, PageTitle, SectionLabel } from "@/components/ui/Page";
import { CardLink } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";

// Tossing lots: the one place for cloths and for where thrown items landed (owner's request, 2026-10-31). It used to be a section on every
// reading page of a tool with items; now a reading's items are tossed from here, and the reading pages stay as they were drawn.
export default async function TossingLotsPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const [cloths, readings] = await Promise.all([listCloths(session.userId), listTossable(session.userId)]);

  return (
    <Page>
      <PageTitle>Tossing lots</PageTitle>
      <p className="text-sm text-ink-muted leading-relaxed">
        Throw the items of a reading onto a cloth and say where each one landed: in a zone you drew, on the cloth in no zone, or off the cloth. Or let the app throw them
        for you. This works for runes, ogham staves, dice and coins, oracle items, tarot cards, playing cards and charms. The app only counts where things land: it does
        not say what a zone means.
      </p>

      <section aria-labelledby="cloths-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <SectionLabel id="cloths-heading">Your cloths</SectionLabel>
          <ButtonLink href="/lots/cloths/new" variant="quiet">Make a cloth</ButtonLink>
        </div>
        <p className="text-sm text-ink-muted leading-relaxed">
          A cloth is a square you throw items onto. You draw zones on it and name them yourself, such as a ring or one half.
        </p>
        {cloths.length === 0 ? (
          <p className="text-sm text-ink-ghost">You have not made a cloth yet.</p>
        ) : (
          <ul className="space-y-3 list-none p-0">
            {cloths.map((c) => (
              <li key={c.id}>
                <CardLink href={`/lots/cloths/${c.id}`}>
                  <p className="font-medium text-ink-strong break-words">{c.name}</p>
                  {c.description && <p className="text-sm text-ink-faint mt-1 line-clamp-2 break-words">{c.description}</p>}
                  <p className="text-xs text-tone-500 mt-1">{c.zones} zone{c.zones !== 1 ? "s" : ""}</p>
                </CardLink>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="toss-heading" className="space-y-3 pt-4">
        <SectionLabel id="toss-heading">Toss a reading</SectionLabel>
        {readings.length === 0 ? (
          <>
            <p className="text-sm text-ink-ghost">You have no readings with items yet. Make one first, then come back to toss its items.</p>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 list-none p-0 text-sm">
              {CLOTH_KINDS.map((k) => (
                <li key={k}>
                  <Link href={DIVINATION_KIND_START[k].href} className="underline text-accent-ink hover:text-accent-ink-hover">{DIVINATION_KIND_START[k].label}</Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <p className="text-sm text-ink-muted">Choose a reading. Your newest {readings.length === 1 ? "one is" : `${readings.length} are`} listed.</p>
            <ul className="space-y-3 list-none p-0">
              {readings.map((r) => (
                <li key={r.id}>
                  <CardLink href={`/lots/${r.id}`}>
                    <p className="font-medium text-ink-strong break-words">{r.summary || DIVINATION_KIND_LABELS[r.kind]}</p>
                    {r.question && <p className="text-sm text-ink-faint mt-1 line-clamp-2 break-words">{r.question}</p>}
                    <p className="text-xs text-tone-500 mt-1 break-words">
                      {DIVINATION_KIND_LABELS[r.kind]} · {parseDate(r.created_at).toLocaleDateString()}
                      {r.tossed_on ? ` · Tossed on ${r.tossed_on}` : ""}
                    </p>
                  </CardLink>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </Page>
  );
}

export const metadata = { title: "Tossing lots" };
