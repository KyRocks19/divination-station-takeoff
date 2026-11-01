import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { chanceWords, listTrials, numbersOf, RV_WORDS } from "@/lib/remoteview";
import { shareState } from "@/lib/remoteview-share";
import ReadingList from "@/components/tools/ReadingList";
import ShareFacts from "@/components/remoteview/ShareFacts";

export default async function RemoteViewPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  const [trials, share] = await Promise.all([listTrials(session.userId), shareState(session.userId)]);
  const n = numbersOf(trials);

  const results =
    n.trials === 0
      ? "You have no judged trials yet."
      : `Judged trials: ${n.trials}. You chose the target ${n.hits} time${n.hits === 1 ? "" : "s"}. Guessing alone would give about ${n.expected.toFixed(1)}. The chance of ${n.hits} or more by guessing alone is ${chanceWords(n.chance)}.`;

  return (
    <ReadingList
      title="Blind-target practice"
      newHref="/remoteview/new"
      newLabel="Start a trial"
      intro={[RV_WORDS.here, RV_WORDS.honest, results]}
      listLabel="Your trials"
      emptyText="No trials are saved."
      items={trials.map((t) => ({
        id: t.id,
        href: `/remoteview/${t.id}`,
        headline:
          t.state === "judged" ? (t.choice_index === t.target_index ? "Chose the target" : "Chose another option") : t.state === "sealed" ? "Impression sealed: choose among the options" : "Waiting for your impression",
        question: null,
        created_at: t.created_at,
        entry_count: t.entry_count,
      }))}
      extra={
        <div className="space-y-4">
          <p className="text-sm">
            <Link href="/remoteview/daily" className="text-accent-ink hover:text-accent-ink-hover underline">Daily five-choice trials</Link>
            <span className="text-ink-faint"> — a quick trial with five shapes and a seal you can check.</span>
          </p>
          <ShareFacts initial={share} />
        </div>
      }
    />
  );
}

export const metadata = { title: "Blind-target practice" };
