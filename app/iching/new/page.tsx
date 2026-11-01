import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import CastForm from "@/components/iching/CastForm";
import { BackLink, Page, PageTitle } from "@/components/ui/Page";

export default async function CastPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const prefs = await getPrefs(session.userId);

  return (
    <Page>
      <BackLink href="/iching">← I Ching</BackLink>
      <PageTitle>Cast the I Ching</PageTitle>

      <CastForm hints={prefs.scaffolding === "more"} />
    </Page>
  );
}

export const metadata = { title: "Cast the I Ching" };
