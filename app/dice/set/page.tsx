import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import { DICE_OBJECTS } from "@/lib/dice";
import { BackLink, Page, PageTitle } from "@/components/ui/Page";

export default async function FaceSetPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  // How many faces of each object the person has written their own words for.
  const written = await query<{ card_id: string }>(
    `SELECT card_id FROM card_customizations
     WHERE user_id = $1 AND (card_id LIKE 'die-%' OR card_id LIKE 'coin-%')
       AND (COALESCE(TRIM(upright_keywords), '') <> '' OR COALESCE(TRIM(upright_description), '') <> '')`,
    [session.userId]
  );
  const count = (id: string) => written.filter((w) => (id === "coin" ? w.card_id.startsWith("coin-") : w.card_id.startsWith(`die-${id}-`))).length;

  return (
    <Page>
      <BackLink href="/dice">
        ← Dice and coins
      </BackLink>
      <PageTitle>What the faces mean to you</PageTitle>
      <p className="text-sm text-ink-muted leading-relaxed">
        Choose a coin or a die and write what each of its faces means to you. The app supplies no meanings.
      </p>
      <ul className="space-y-3 list-none p-0">
        {DICE_OBJECTS.map((o) => (
          <li key={o.id}>
            <Link
              href={`/dice/set/${o.id}`}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 bg-surface border border-line rounded-card p-4 hover:border-line-hover transition-colors"
            >
              <span className="font-medium text-ink-strong">{o.name}</span>
              <span className="text-xs text-ink-faint whitespace-nowrap">
                {count(o.id)} of {o.faces} with your words
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  );
}

export const metadata = { title: "Your dice faces" };
