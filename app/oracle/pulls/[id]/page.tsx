import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { readingSky } from "@/lib/sky";
import { listEntries, type DivinationEntry } from "@/lib/divinations";
import { loadPull, toId, type OraclePull } from "@/lib/oracle";
import PullView from "@/components/oracle/PullView";
import { BackLink } from "@/components/ui/Page";

export default async function OraclePullPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const [pull, prefs] = await Promise.all([loadPull(session.userId, toId(id)), getPrefs(session.userId)]);
  if (!pull) {
    return (
      <div className="max-w-page mx-auto px-4 py-8 space-y-3">
        <p className="text-ink-faint">Pull not found.</p>
        <BackLink href="/oracle">
          ← Oracle deck
        </BackLink>
      </div>
    );
  }

  // Dates become text here, so the view starts with the same shape the API returns.
  const initialPull: OraclePull = JSON.parse(JSON.stringify(pull));
  const initialEntries: DivinationEntry[] = JSON.parse(JSON.stringify(await listEntries(session.userId, pull.id)));
  return (
    <PullView initialPull={initialPull} initialEntries={initialEntries} sky={readingSky(initialPull, prefs.hemisphere)} />
  );
}

export const metadata = { title: "A pull" };
