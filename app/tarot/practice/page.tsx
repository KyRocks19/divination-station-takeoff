import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import TarotPractice from "@/components/TarotPractice";
import { BackLink, Page, PageTitle } from "@/components/ui/Page";

// Tarot practice with a sealed card (release plan §6 idea 4): the same loop as blind-target practice, with the tarot.
export default async function TarotPracticePage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  return (
    <Page>
      <div className="space-y-1">
        <BackLink href="/tarot">← Tarot</BackLink>
        <PageTitle>Tarot practice</PageTitle>
      </div>
      <p className="text-sm text-ink-muted leading-relaxed max-w-2xl">
        Practice sensing a card before you see it. Your guesses are kept as your own record, with what chance alone would give beside them. Only
        you see it, and you can delete it at any time.
      </p>
      <TarotPractice />
    </Page>
  );
}

export const metadata = { title: "Tarot practice" };
