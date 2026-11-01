import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { readingSky } from "@/lib/sky";
import { listEntries, type DivinationEntry } from "@/lib/divinations";
import { toId } from "@/lib/oracle";
import { loadAnswer, loadSwing, type PendulumAnswer } from "@/lib/pendulum";
import AnswerView from "@/components/pendulum/AnswerView";
import { BackLink } from "@/components/ui/Page";

export default async function PendulumAnswerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const [found, prefs] = await Promise.all([loadAnswer(session.userId, toId(id)), getPrefs(session.userId)]);
  if (!found) {
    return (
      <div className="max-w-page mx-auto px-4 py-8 space-y-3">
        <p className="text-ink-faint">Answer not found.</p>
        <BackLink href="/pendulum">
          ← Pendulum
        </BackLink>
      </div>
    );
  }

  // Dates become text here, so the view starts with the same shape the API returns.
  const initialAnswer: PendulumAnswer = JSON.parse(JSON.stringify(found));
  const initialEntries: DivinationEntry[] = JSON.parse(JSON.stringify(await listEntries(session.userId, found.id)));
  // The person's words for this swing as they are today, to set beside the words it had when this was asked.
  const swingNow = found.swing_id === null ? null : await loadSwing(session.userId, found.swing_id);
  return (
    <AnswerView
      initialAnswer={initialAnswer}
      swingNow={swingNow ? { meaning: swingNow.meaning, earlierCount: swingNow.earlier.length } : null}
      initialEntries={initialEntries}
      sky={readingSky(initialAnswer, prefs.hemisphere)}
    />
  );
}

export const metadata = { title: "A pendulum session" };
