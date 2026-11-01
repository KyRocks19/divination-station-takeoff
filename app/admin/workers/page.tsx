import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { BackLink, Page, PageTitle } from "@/components/ui/Page";
import WorkerTokens from "@/components/admin/WorkerTokens";

// The owner's picture computers: a token for each studio (scripts/image-worker.ts), made and revoked here. Only an admin sees it (the API checks too).
export default async function WorkersPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  if (!session.isAdmin) redirect("/settings");

  return (
    <Page>
      <BackLink href="/settings">← Settings</BackLink>
      <PageTitle>Picture computers</PageTitle>
      <WorkerTokens />
    </Page>
  );
}

export const metadata = { title: "Picture computers" };
