import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { poolCounts } from "@/lib/bibliomancy";
import PullForm from "@/components/bibliomancy/PullForm";
import { BackLink, Page, PageTitle } from "@/components/ui/Page";

export default async function PullPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const [prefs, counts] = await Promise.all([getPrefs(session.userId), poolCounts(session.userId)]);

  return (
    <Page>
      <BackLink href="/bibliomancy">← Bibliomancy</BackLink>
      <PageTitle>Pull from your writing</PageTitle>

      <PullForm hints={prefs.scaffolding === "more"} counts={counts} />
    </Page>
  );
}

export const metadata = { title: "Pull from your writing" };
