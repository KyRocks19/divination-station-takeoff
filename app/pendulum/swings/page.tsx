import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { listSwings, type PendulumSwing } from "@/lib/pendulum";
import SwingsEditor from "@/components/pendulum/SwingsEditor";
import { BackLink, Page, PageTitle } from "@/components/ui/Page";

export default async function PendulumSwingsPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const [swings, prefs] = await Promise.all([listSwings(session.userId), getPrefs(session.userId)]);
  // Dates become text here, so the editor starts with the same shape the API returns.
  const initialSwings: PendulumSwing[] = JSON.parse(JSON.stringify(swings));

  return (
    <Page>
      <BackLink href="/pendulum">
        ← Pendulum
      </BackLink>
      <PageTitle>Your swings</PageTitle>
      <SwingsEditor initialSwings={initialSwings} hints={prefs.scaffolding === "more"} />
    </Page>
  );
}

export const metadata = { title: "Your swings" };
