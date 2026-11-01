import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { toId } from "@/lib/oracle";
import { loadCloth, zoneCounts, type ZoneCount } from "@/lib/cloths";
import ClothEditor from "@/components/cloth/ClothEditor";
import { BackLink, Page, PageTitle, SectionLabel } from "@/components/ui/Page";

export default async function ClothPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const cloth = await loadCloth(session.userId, toId(id));
  const counts: { counts: ZoneCount[]; readings: number } = cloth ? await zoneCounts(session.userId, cloth.id) : { counts: [], readings: 0 };

  if (!cloth) {
    return (
      <div className="max-w-page mx-auto px-4 py-8 space-y-3">
        <p className="text-ink-faint">Cloth not found.</p>
        <BackLink href="/lots">← Tossing lots</BackLink>
      </div>
    );
  }

  const total = counts.counts.reduce((s, c) => s + c.n, 0);
  const words = (c: ZoneCount) => (c.where_kind === "zone" ? c.zone_name : c.where_kind === "none" ? "On the cloth, in no zone" : "Off the cloth");

  return (
    <Page>
      <BackLink href="/lots">← Tossing lots</BackLink>
      <PageTitle>{cloth.name}</PageTitle>
      <ClothEditor initial={{ id: cloth.id, name: cloth.name, description: cloth.description ?? "", zones: cloth.zones }} />

      <section aria-labelledby="cloth-counts" className="space-y-2">
        <SectionLabel id="cloth-counts">Where things have landed on this cloth</SectionLabel>
        {total === 0 ? (
          <p className="text-sm text-ink-ghost">
            Nothing yet. After a throw of runes, ogham staves, dice, coins, an oracle pull or a tarot reading, open Tossing lots, choose that reading and choose this cloth.
          </p>
        ) : (
          <>
            <p className="text-xs text-ink-faint">
              {total} item{total === 1 ? "" : "s"} in {counts.readings} reading{counts.readings === 1 ? "" : "s"}, counted as they were recorded. These are plain counts: the
              app does not say what they mean.
            </p>
            <table className="w-full max-w-md text-sm">
              <caption className="sr-only">Items that landed in each zone of {cloth.name}</caption>
              <thead>
                <tr className="text-left text-xs text-ink-faint">
                  <th scope="col" className="py-1 pr-3 font-normal">Where</th>
                  <th scope="col" className="py-1 text-right font-normal">Items</th>
                </tr>
              </thead>
              <tbody>
                {counts.counts.map((c) => (
                  <tr key={`${c.where_kind}-${c.zone_name ?? ""}`} className="border-t border-line">
                    <th scope="row" className="py-1.5 pr-3 text-left font-normal text-ink-soft break-words">{words(c)}</th>
                    <td className="py-1.5 text-right text-ink-strong">{c.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>
    </Page>
  );
}

export const metadata = { title: "Cloth" };
