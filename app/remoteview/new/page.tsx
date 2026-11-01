import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import TrialForm from "@/components/remoteview/TrialForm";
import { BackLink, Page, PageTitle } from "@/components/ui/Page";

export default async function NewTrialPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  return (
    <Page>
      <BackLink href="/remoteview">← Blind-target practice</BackLink>
      <PageTitle>Start a blind-target trial</PageTitle>
      <TrialForm />
    </Page>
  );
}

export const metadata = { title: "Start a trial" };
