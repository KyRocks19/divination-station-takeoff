import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { DIVINATION_KIND_LABELS } from "@/lib/divination-kinds";
import BlotForm from "@/components/blots/BlotForm";
import { BackLink, Page, PageTitle } from "@/components/ui/Page";

export default async function NewBlotPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  const prefs = await getPrefs(session.userId);

  return (
    <Page>
      <BackLink href="/blots">← {DIVINATION_KIND_LABELS.blots}</BackLink>
      <PageTitle>Press an ink blot</PageTitle>
      <BlotForm hints={prefs.scaffolding === "more"} />
    </Page>
  );
}

export const metadata = { title: "Press an ink blot" };
