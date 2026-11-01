import Link from "next/link";
import { Page, PageTitle } from "@/components/ui/Page";
import PrivacyNotice from "@/components/PrivacyNotice";

// Public on purpose (see PUBLIC_PATHS in proxy.ts): a person can read it before they have an account, from the sign-in page.
export const metadata = { title: "Privacy and terms" };

export default function PrivacyPage() {
  return (
    <Page>
      <Link href="/" className="text-xs text-ink-ghost hover:text-tone-400 transition-colors">← Home</Link>
      <PageTitle>Privacy and terms</PageTitle>
      <PrivacyNotice />
    </Page>
  );
}
