import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { listLayouts } from "@/lib/layouts";
import { Page, PageTitle } from "@/components/ui/Page";
import { CardLink } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";

export default async function LayoutsPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const layouts = await listLayouts(session.userId);

  return (
    <Page>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <PageTitle>Your layouts</PageTitle>
        <ButtonLink href="/layouts/new" variant="primary">
          Make a layout
        </ButtonLink>
      </div>

      <p className="text-sm text-ink-muted leading-relaxed">
        A layout is a list of named positions that you make yourself, for example &quot;Where I am&quot;, &quot;What
        blocks me&quot;, &quot;What helps&quot;. Choose one when you read tarot, or draw runes, ogham staves, oracle cards, or dice,
        and one item is drawn for each position. A position can have a colour of your choosing, and a layout can be
        laid out on a board with each position where you put it, like the Celtic Cross. The starting spreads (the
        Celtic Cross included) are yours to change or delete.
      </p>

      {layouts.length === 0 ? (
        <p className="text-sm text-ink-ghost">You have not made a layout yet.</p>
      ) : (
        <ul className="space-y-3 list-none p-0">
          {layouts.map((l) => (
            <li key={l.id}>
              <CardLink href={`/layouts/${l.id}`}>
                <p className="font-medium text-ink-strong break-words">{l.name}</p>
                {l.description && <p className="text-sm text-ink-faint mt-1 line-clamp-2 break-words">{l.description}</p>}
                <p className="text-xs text-tone-500 mt-1 break-words">
                  {l.positions.length} position{l.positions.length !== 1 ? "s" : ""}: {l.positions.map((p) => p.name).join(", ")}
                </p>
              </CardLink>
            </li>
          ))}
        </ul>
      )}

      <p className="text-sm text-ink-muted pt-4">
        Cloths, for items you throw rather than draw, are in{" "}
        <Link href="/lots" className="underline text-accent-ink hover:text-accent-ink-hover">Tossing lots</Link>.
      </p>
    </Page>
  );
}

export const metadata = { title: "Your layouts" };
