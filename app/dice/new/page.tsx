import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { listLayouts } from "@/lib/layouts";
import ThrowForm from "@/components/dice/ThrowForm";
import { BackLink, Page, PageTitle } from "@/components/ui/Page";

export default async function ThrowDicePage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const [prefs, layouts] = await Promise.all([getPrefs(session.userId), listLayouts(session.userId)]);

  return (
    <Page>
      <BackLink href="/dice">
        ← Dice and coins
      </BackLink>
      <PageTitle>Throw some dice</PageTitle>

      <ThrowForm hints={prefs.scaffolding === "more"} layouts={layouts} />
    </Page>
  );
}

export const metadata = { title: "Throw dice or coins" };
