import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import NoteForm from "@/components/signs/NoteForm";
import { BackLink, Page, PageTitle } from "@/components/ui/Page";

export default async function NewNotePage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  const prefs = await getPrefs(session.userId);

  return (
    <Page>
      <BackLink href="/signs">← Signs and dreams</BackLink>
      <PageTitle>Note a sign or dream</PageTitle>
      <NoteForm hints={prefs.scaffolding === "more"} />
    </Page>
  );
}

export const metadata = { title: "Note a sign or dream" };
