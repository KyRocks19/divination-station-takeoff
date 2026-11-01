import Link from "next/link";
import { tallyAcrossCloths, tallyByCloth, type ClothCountRow, type ClothTallyRow } from "@/lib/cloth-core";

interface Props {
  rows: ClothCountRow[];
  /** The tools being shown, or null for all of them. */
  shown: readonly string[] | null;
}

function CountTable({ caption, rows, showCloths }: { caption: string; rows: ClothTallyRow[]; showCloths: boolean }) {
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="text-left text-xs text-ink-faint">
          <th scope="col" className="py-1 pr-3 font-normal">Where</th>
          {showCloths && <th scope="col" className="py-1 pr-3 text-right font-normal">Cloths</th>}
          <th scope="col" className="py-1 text-right font-normal">Items</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className="border-t border-line">
            <th scope="row" className="py-1.5 pr-3 text-left font-normal text-ink-soft break-words">{r.label}</th>
            {showCloths && <td className="py-1.5 pr-3 text-right text-ink-faint">{r.cloths}</td>}
            <td className="py-1.5 text-right text-ink-strong">{r.n}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Where items landed on the person's cloths, as plain counts: for each cloth, and added up over all of them when there is more than one.
 * Nothing here says what a zone means; the zone names are the person's own words.
 */
export default function ClothCountsInPatterns({ rows, shown }: Props) {
  const byCloth = tallyByCloth(rows, shown);
  if (byCloth.length === 0) return null;
  const across = byCloth.length > 1 ? tallyAcrossCloths(rows, shown) : [];
  return (
    <section aria-labelledby="cloth-patterns" className="space-y-3">
      <h2 id="cloth-patterns" className="text-xs text-ink-faint uppercase tracking-widest">Where things landed on your cloths</h2>
      <p className="text-xs text-ink-ghost">
        Counts of the items you recorded on a cloth, by the zone they landed in. They say where things landed, not what it means.{" "}
        <Link href="/lots" className="underline hover:text-ink-soft">Your cloths</Link>
      </p>
      {across.length > 0 && (
        <div className="bg-surface border border-line rounded-card p-4 space-y-1">
          <h3 className="text-sm text-ink-strong">Over all your cloths</h3>
          <p className="text-xs text-ink-faint">Zones with the same name (ignoring capitals) are added together. That only follows the words you typed.</p>
          <CountTable caption="Items that landed in each zone, over all your cloths" rows={across} showCloths />
        </div>
      )}
      {byCloth.map((c) => (
        <div key={c.key} className="bg-surface border border-line rounded-card p-4 space-y-1">
          <h3 className="text-sm text-ink-strong break-words">{c.name}</h3>
          <p className="text-xs text-ink-faint">{c.total} item{c.total === 1 ? "" : "s"}</p>
          <CountTable caption={`Items that landed in each zone of ${c.name}`} rows={c.rows} showCloths={false} />
        </div>
      ))}
    </section>
  );
}
