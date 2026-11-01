import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Page, PageTitle } from "@/components/ui/Page";
import PrivacyNotice from "@/components/PrivacyNotice";
import AcknowledgeButton from "@/components/AcknowledgeButton";
import { Card } from "@/components/ui/Card";
import RecoveryCodes from "@/components/account/RecoveryCodes";
import { privacyAcknowledged, safeFrom } from "@/lib/privacy";

// The one-time "Before you start" screen: the privacy and terms text and a button that says it was read.
export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  const from = safeFrom((await searchParams).from);
  if (await privacyAcknowledged(session.userId)) redirect(from);

  return (
    <Page>
      <PageTitle>Before you start</PageTitle>
      <p className="text-sm text-ink-faint">A few plain words about your writing and who can see it. It takes about a minute to read.</p>
      <PrivacyNotice />
      <Card className="space-y-3" role="region" aria-labelledby="way-back-title">
        <h2 id="way-back-title" className="font-semibold text-ink-strong">A way back in, if you forget your password</h2>
        <p className="text-xs text-ink-faint">Optional. You can also do this later in Settings.</p>
        <RecoveryCodes heading="h3" />
      </Card>
      <AcknowledgeButton next={from} />
    </Page>
  );
}

export const metadata = { title: "Before you start" };
