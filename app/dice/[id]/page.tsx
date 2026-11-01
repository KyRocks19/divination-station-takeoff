import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { readingSky } from "@/lib/sky";
import { listEntries, type DivinationEntry } from "@/lib/divinations";
import { toId } from "@/lib/oracle";
import { loadThrow, type DiceThrow } from "@/lib/dice";
import { ownNames } from "@/lib/own-names";
import ThrowView from "@/components/dice/ThrowView";
import { BackLink } from "@/components/ui/Page";

export default async function DiceThrowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const [found, prefs] = await Promise.all([loadThrow(session.userId, toId(id)), getPrefs(session.userId)]);
  if (!found) {
    return (
      <div className="max-w-page mx-auto px-4 py-8 space-y-3">
        <p className="text-ink-faint">Throw not found.</p>
        <BackLink href="/dice">
          ← Dice and coins
        </BackLink>
      </div>
    );
  }

  // Dates become text here, so the view starts with the same shape the API returns.
  const initialThrow: DiceThrow = JSON.parse(JSON.stringify(found));
  const initialEntries: DivinationEntry[] = JSON.parse(JSON.stringify(await listEntries(session.userId, found.id)));
  const ownSideNames = initialThrow.results.some((r) => r.object === "knucklebone") ? await ownNames(session.userId) : {};
  return (
    <ThrowView
      initialThrow={initialThrow}
      initialEntries={initialEntries}
      ownNames={ownSideNames}
      sky={readingSky(initialThrow, prefs.hemisphere)}
    />
  );
}

export const metadata = { title: "A throw" };
