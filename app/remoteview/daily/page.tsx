import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { dailyNumbers, recentDaily } from "@/lib/remoteview-daily";
import DailyPlay from "@/components/remoteview/DailyPlay";
import { BackLink, Page, PageTitle } from "@/components/ui/Page";

export default async function DailyPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const [trials, numbers] = await Promise.all([recentDaily(session.userId), dailyNumbers(session.userId)]);

  return (
    <Page>
      <BackLink href="/remoteview">← Blind-target practice</BackLink>
      <PageTitle>Daily five-choice trials</PageTitle>
      <DailyPlay initialTrials={JSON.parse(JSON.stringify(trials))} initialTotals={{ trials: numbers.trials, hits: numbers.hits }} />
    </Page>
  );
}

export const metadata = { title: "Daily five-choice trials" };
