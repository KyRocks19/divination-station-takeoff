import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { DIVINATION_KIND_LABELS } from "@/lib/divination-kinds";
import TeaForm from "@/components/tea/TeaForm";
import { BackLink, Page, PageTitle } from "@/components/ui/Page";

export default async function NewTeaPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  const prefs = await getPrefs(session.userId);

  return (
    <Page>
      <BackLink href="/tea">← {DIVINATION_KIND_LABELS.tea}</BackLink>
      <PageTitle>Brew a cup</PageTitle>
      <TeaForm hints={prefs.scaffolding === "more"} />
    </Page>
  );
}

export const metadata = { title: "Brew a cup" };
