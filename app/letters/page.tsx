import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Page, PageTitle } from "@/components/ui/Page";
import LettersPanel from "@/components/LettersPanel";

// Letters between members of a circle (migration 103). The API checks every step again; this page only needs a signed-in person.
export default async function LettersPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login?from=/letters");

  return (
    <Page>
      <PageTitle>Letters</PageTitle>
      <p className="text-sm text-ink-muted leading-relaxed max-w-2xl">
        Ask someone in your circle for a reading, or read for them. A reader does a reading with any tool and sends a letter in their own words.
        You open it when you are ready, and later, if you want to, you write back how things went. Your reply shows on their reading, so they
        can learn from the people they read for. Nothing here is scored. Only the two people a letter is between can see it.
      </p>
      <LettersPanel />
    </Page>
  );
}

export const metadata = { title: "Letters" };
