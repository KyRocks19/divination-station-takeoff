import { notFound } from "next/navigation";
import { BackLink } from "@/components/ui/Page";
import { AskContent } from "@/components/AskContent";
import { hiddenIn } from "@/lib/edition-features";
import { getSession } from "@/lib/session";
import { aiReadyFor } from "@/lib/ai-ready";

export default async function AskClaudePage() {
  // Without a Claude key that works the page is not there at all (lib/ai-ready-core.ts).
  const session = await getSession();
  if (!(await aiReadyFor(session.userId)).claude) notFound();
  return (
    <div className="max-w-page mx-auto px-4 py-6">
      <BackLink href="/">
        ← Home
      </BackLink>
      <AskContent forum={!hiddenIn(process.env.DS_EDITION, "/forum")} />
    </div>
  );
}
