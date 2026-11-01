import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { listSwings } from "@/lib/pendulum";
import AskForm from "@/components/pendulum/AskForm";
import { BackLink, Page, PageTitle } from "@/components/ui/Page";

/** One plain line saying how many swings are in play and how many of them the person has put words to. */
function swingsLine(inPlay: number, worded: number): string {
  const one = inPlay === 1;
  const swings = `${inPlay} swing${one ? " is" : "s are"} in play`;
  if (worded === 0) return `${swings}, and you have not written what ${one ? "it means" : "any of them means"} to you.`;
  if (worded === inPlay) return `${swings}, and you have written what ${one ? "it means" : "all of them mean"} to you.`;
  return `${swings}, and you have written what ${worded} of them ${worded === 1 ? "means" : "mean"} to you.`;
}

export default async function AskThePendulumPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const [swings, prefs] = await Promise.all([listSwings(session.userId), getPrefs(session.userId)]);
  const inPlay = swings.filter((s) => s.in_play === 1).length;
  const worded = swings.filter((s) => s.in_play === 1 && s.meaning).length;

  return (
    <Page>
      <BackLink href="/pendulum">
        ← Pendulum
      </BackLink>
      <PageTitle>Ask the pendulum</PageTitle>

      <p className="text-sm text-ink-muted">
        {swingsLine(inPlay, worded)}{" "}
        <Link href="/pendulum/swings" className="text-tone-400 hover:text-tone-300 underline underline-offset-2">Your swings</Link>
      </p>

      <AskForm hints={prefs.scaffolding === "more"} />
    </Page>
  );
}

export const metadata = { title: "Ask the pendulum" };
