import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import DrawForm from "@/components/playingcards/DrawForm";
import { BackLink, Page, PageTitle } from "@/components/ui/Page";

export default async function DrawPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  const prefs = await getPrefs(session.userId);

  return (
    <Page>
      <BackLink href="/playingcards">← Playing cards</BackLink>
      <PageTitle>Draw playing cards</PageTitle>
      <DrawForm hints={prefs.scaffolding === "more"} />
    </Page>
  );
}

export const metadata = { title: "Draw playing cards" };
