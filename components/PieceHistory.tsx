import Link from "next/link";
import { parseDate, toISOString } from "@/lib/date";
import type { DivinationKind } from "@/lib/divination-kinds";
import { piecesCameUp } from "@/lib/piece-history";
import { SectionLabel } from "@/components/ui/Page";

interface Props {
  userId: number;
  kind: DivinationKind;
  /** The key the piece is kept under in the person's readings ("rune-fehu", "hexagram-12", "geomancy-via", "d6:3"). */
  pieceKey: string;
  /** What the piece is called: "rune", "stave", "hexagram", "figure", "face". */
  noun: string;
  /** What a reading with this tool is called, for the empty line: "draw", "cast", "throw". */
  readingWord: string;
}

/** "Times this rune came up": the person's readings in which a piece came up, each a link, newest first. The same section tarot cards and oracle items have. */
export default async function PieceHistory({ userId, kind, pieceKey, noun, readingWord }: Props) {
  const { items, total, more } = await piecesCameUp(userId, kind, pieceKey);
  const heading = `piece-history-${pieceKey.replace(/[^a-z0-9]/gi, "-")}`;
  return (
    <section aria-labelledby={heading} className="space-y-3">
      <SectionLabel id={heading}>
        Times this {noun} came up{total > 0 ? ` (${more ? `${items.length} of ${total}` : total})` : ""}
      </SectionLabel>
      {items.length === 0 ? (
        <p className="text-sm text-ink-ghost">This {noun} has not come up in a {readingWord} yet.</p>
      ) : (
        <ul className="space-y-2 list-none p-0 m-0">
          {items.map((c) => (
            <li key={c.id}>
              <Link
                href={c.href}
                className="block bg-surface border border-line hover:border-line-hover rounded-card px-4 py-3 min-h-11 transition-colors"
              >
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <time className="text-xs text-ink-faint" dateTime={toISOString(c.when)} suppressHydrationWarning>
                    {parseDate(c.when).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </time>
                  {c.entries > 0 && (
                    <span className="text-xs text-tone-500">
                      {c.entries} {c.entries === 1 ? "entry" : "entries"} written
                    </span>
                  )}
                </span>
                {c.question && <span className="block text-sm text-ink-soft mt-1 line-clamp-2 break-words">{c.question}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
